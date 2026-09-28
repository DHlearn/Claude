"""
HP CARGA - Consolidado de PDF a Excel.

Genera HP_CARGA_CONSOLIDADO.xlsx con las hojas:
    - HP_CARGA
    - ERRORES_ESTRUCTURA
"""

import os
import re
import unicodedata
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path

import pandas as pd
import pdfplumber


# ============================================================
# CONFIGURACIÓN
# ============================================================

CARPETA = Path(
    r"C:\Users\tpehod\OneDrive - Techint E&C\Repositorio Temporal Informacion Logistica\04 Data Planificacion Diario\HP CARGA"
)

SALIDA = CARPETA / "HP_CARGA_CONSOLIDADO.xlsx"

HOJA_DATOS = "HP_CARGA"
HOJA_ERRORES = "ERRORES_ESTRUCTURA"

# Procesos en paralelo para leer PDF (1 = secuencial)
PROCESOS = max(1, min(4, (os.cpu_count() or 2) - 1))

COLUMNAS_SALIDA = [
    "Fecha",
    "Helicóptero",
    "Area usuaria PPC",
    "Origen",
    "Destino",
    "Ubicación especifica en destino",
    "Descripción de la carga",
    "Empresa dueña de carga",
    "Peso bruto kg",
    "Archivo",
]

COLUMNAS_ERRORES = [
    "Archivo",
    "Página",
    "Tabla",
    "Fila",
    "Columnas detectadas",
    "Contenido",
]

# Estructura esperada de la tabla del PDF
COLUMNAS_ESPERADAS = 19
COL_FECHA = 0
COL_HELICOPTERO = 1
COL_OPERACION = 5
COL_AREA = 6
COL_ORIGEN = 8
COL_DESTINO = 11
COL_UBICACION = 12
COL_DESCRIPCION = 14
COL_EMPRESA = 15
COL_PESO = 16

CONFIG_TABLA = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,
    "join_tolerance": 3,
    "intersection_tolerance": 4,
    "edge_min_length": 3,
    "text_x_tolerance": 1,
    "text_y_tolerance": 2,
}

VALORES_VACIOS = {"", "-", "--", ".", "nan", "none", "null"}

PALABRAS_ENCABEZADO = (
    "fecha",
    "helicoptero",
    "operacion",
    "origen",
    "destino",
    "descripcion",
    "peso",
)

MESES = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11,
    "dic": 12,
}


# ============================================================
# REGEX PRECOMPILADAS
# ============================================================

RE_ESPACIOS = re.compile(r"\s+")
RE_NO_ALFANUM = re.compile(r"[^a-z0-9]+")
RE_GUIONES = re.compile(r"-+")
RE_FECHA_TEXTO = re.compile(r"(\d{1,2})-([a-záéíóúñ]{3,})-(\d{2,4})")
RE_HELICOPTERO = re.compile(r"\b(BK|MI)\s*OB[\s\-]*(\d{4})\b")
RE_MILES = re.compile(r"^\d{1,3}(,\d{3})+$")
RE_NO_NUMERO = re.compile(r"[^0-9.]")
RE_SEP_FECHA = re.compile(r"[./ ]")


# ============================================================
# LIMPIEZA GENERAL
# ============================================================

def limpiar(valor):
    if valor is None:
        return ""
    return RE_ESPACIOS.sub(" ", str(valor)).strip()


def normalizar(valor):
    texto = unicodedata.normalize("NFD", limpiar(valor).lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return RE_NO_ALFANUM.sub(" ", texto).strip()


def limpiar_texto_campo(valor):
    texto = limpiar(valor)
    return "" if texto.lower() in VALORES_VACIOS else texto


# ============================================================
# CONVERSIONES
# ============================================================

def convertir_fecha(valor):
    texto = limpiar(valor).lower()
    if not texto:
        return pd.NaT

    texto = RE_GUIONES.sub("-", RE_SEP_FECHA.sub("-", texto))

    # Ejemplos: 01-set-26, 1-sep-2026
    patron = RE_FECHA_TEXTO.search(texto)
    if patron:
        mes = MESES.get(normalizar(patron.group(2))[:3])
        if mes:
            anio = int(patron.group(3))
            if anio < 100:
                anio += 2000
            try:
                return datetime(anio, mes, int(patron.group(1)))
            except ValueError:
                return pd.NaT

    # Fecha numérica
    return pd.to_datetime(texto, errors="coerce", dayfirst=True)


def limpiar_helicoptero(valor):
    texto = limpiar(valor).upper().replace("–", "-").replace("—", "-")

    # Ejemplos: BK OB-2240, MI OB-2020, BK OB 2225
    patron = RE_HELICOPTERO.search(texto)
    if patron:
        return f"{patron.group(1)} OB-{patron.group(2)}"

    # Conservar valores desconocidos (pueden aparecer nuevas aeronaves)
    return texto


def limpiar_ubicacion(valor):
    texto = limpiar_texto_campo(valor)
    if not texto:
        return ""

    n = normalizar(texto)

    if n == "hp" or n.startswith("hp ") or "helipuerto" in n:
        return "HP"

    if "zona enganche" in n or "zona de enganche" in n or n == "enganche":
        return "Zona Enganche"

    if "plataforma" in n:
        return "Plataforma"

    return texto


def convertir_peso(valor):
    texto = limpiar(valor).lower()
    if not texto:
        return None

    texto = texto.replace("kgs", "").replace("kg", "").replace(" ", "")

    if RE_MILES.match(texto):           # 1,500 -> 1500
        texto = texto.replace(",", "")
    elif "," in texto and "." not in texto:  # 1500,5 -> 1500.5
        texto = texto.replace(",", ".")

    texto = RE_NO_NUMERO.sub("", texto)
    if not texto:
        return None

    try:
        return float(texto)
    except ValueError:
        return None


# ============================================================
# EXTRACCIÓN DE UN PDF
# ============================================================

def buscar_encabezado(filas):
    for i, fila in enumerate(filas):
        contenido = normalizar(" ".join(fila))
        if sum(p in contenido for p in PALABRAS_ENCABEZADO) >= 5:
            return i
    return None


def procesar_pdf(archivo):
    """
    Procesa un PDF y devuelve (registros, errores, log).
    Se ejecuta en un proceso aparte, por eso no imprime directamente.
    """
    registros = []
    errores = []
    log = []
    nombre = archivo.name

    try:
        with pdfplumber.open(archivo) as pdf:
            for pagina_numero, pagina in enumerate(pdf.pages, start=1):
                tablas = pagina.extract_tables(table_settings=CONFIG_TABLA)
                log.append(f"   Página {pagina_numero}: {len(tablas)} tabla(s)")

                # Liberar memoria de la página procesada
                pagina.flush_cache()

                for numero_tabla, tabla in enumerate(tablas, start=1):
                    if not tabla:
                        continue

                    filas = [
                        fila_limpia
                        for fila in tabla
                        if any(fila_limpia := [limpiar(x) for x in fila])
                    ]

                    if len(filas) < 2:
                        continue

                    indice_encabezado = buscar_encabezado(filas)
                    if indice_encabezado is None:
                        continue

                    for fila_numero, fila in enumerate(
                        filas[indice_encabezado + 1:], start=1
                    ):
                        # Encabezado repetido
                        if fila and normalizar(fila[0]) == "fecha":
                            continue

                        if len(fila) != COLUMNAS_ESPERADAS:
                            errores.append({
                                "Archivo": nombre,
                                "Página": pagina_numero,
                                "Tabla": numero_tabla,
                                "Fila": fila_numero,
                                "Columnas detectadas": len(fila),
                                "Contenido": " | ".join(fila),
                            })
                            continue

                        # Solo CARGA (se filtra antes de convertir campos)
                        if normalizar(fila[COL_OPERACION]) != "carga":
                            continue

                        registros.append({
                            "Fecha": convertir_fecha(fila[COL_FECHA]),
                            "Helicóptero": limpiar_helicoptero(fila[COL_HELICOPTERO]),
                            "Area usuaria PPC": limpiar_texto_campo(fila[COL_AREA]),
                            "Origen": limpiar_texto_campo(fila[COL_ORIGEN]),
                            "Destino": limpiar_texto_campo(fila[COL_DESTINO]),
                            "Ubicación especifica en destino": limpiar_ubicacion(fila[COL_UBICACION]),
                            "Descripción de la carga": limpiar_texto_campo(fila[COL_DESCRIPCION]),
                            "Empresa dueña de carga": limpiar_texto_campo(fila[COL_EMPRESA]),
                            "Peso bruto kg": convertir_peso(fila[COL_PESO]),
                            "Archivo": nombre,
                        })

    except Exception as error:
        log.append(f"   ERROR: {error}")
        errores.append({
            "Archivo": nombre,
            "Página": "",
            "Tabla": "",
            "Fila": "",
            "Columnas detectadas": "",
            "Contenido": f"ERROR GENERAL: {error}",
        })

    return registros, errores, log


# ============================================================
# MENÚ
# ============================================================

def seleccionar_modo():
    print()
    print("=" * 80)
    print("HP CARGA - ACTUALIZACIÓN DEL CONSOLIDADO")
    print("=" * 80)
    print()
    print("1 - RECONSTRUIR TODO")
    print("    Borra lógicamente la base anterior y vuelve")
    print("    a procesar todos los PDF.")
    print()
    print("2 - ACTUALIZAR SOLO PDF NUEVOS")
    print("    Conserva la información existente y procesa")
    print("    únicamente PDF que todavía no figuran en Archivo.")
    print()
    print("0 - SALIR")
    print()

    while True:
        opcion = input("Seleccione una opción [1/2/0]: ").strip()
        if opcion in ("0", "1", "2"):
            return opcion
        print("Opción incorrecta. Ingrese 1, 2 o 0.")


# ============================================================
# LEER EXCEL EXISTENTE (una sola apertura del archivo)
# ============================================================

def leer_excel_existente():
    """Devuelve (df_datos, df_errores) del consolidado actual."""
    vacio_datos = pd.DataFrame(columns=COLUMNAS_SALIDA)
    vacio_errores = pd.DataFrame(columns=COLUMNAS_ERRORES)

    if not SALIDA.exists():
        print()
        print("No existe todavía HP_CARGA_CONSOLIDADO.xlsx")
        print("Se procesarán todos los PDF para crear la base inicial.")
        return vacio_datos, vacio_errores

    try:
        with pd.ExcelFile(SALIDA, engine="openpyxl") as libro:
            hojas = set(libro.sheet_names)

            df_datos = (
                libro.parse(HOJA_DATOS)
                if HOJA_DATOS in hojas
                else vacio_datos
            )
            df_errores = (
                libro.parse(HOJA_ERRORES)
                if HOJA_ERRORES in hojas
                else vacio_errores
            )
    except Exception as error:
        print()
        print("ERROR AL LEER EL EXCEL EXISTENTE:")
        print(error)
        raise

    # Garantizar columnas y orden
    df_datos = df_datos.reindex(columns=COLUMNAS_SALIDA)

    return df_datos, df_errores


# ============================================================
# PROCESAR LISTA DE PDF
# ============================================================

def procesar_pdfs(pdfs):
    registros = []
    errores = []
    total = len(pdfs)

    if PROCESOS > 1 and total > 1:
        with ProcessPoolExecutor(max_workers=PROCESOS) as executor:
            resultados = executor.map(procesar_pdf, pdfs, chunksize=1)
            for numero, (archivo, resultado) in enumerate(
                zip(pdfs, resultados), start=1
            ):
                registros, errores = _acumular(
                    numero, total, archivo, resultado, registros, errores
                )
    else:
        for numero, archivo in enumerate(pdfs, start=1):
            registros, errores = _acumular(
                numero, total, archivo, procesar_pdf(archivo), registros, errores
            )

    return registros, errores


def _acumular(numero, total, archivo, resultado, registros, errores):
    regs, errs, log = resultado
    print()
    print(f"[{numero}/{total}] {archivo.name}")
    for linea in log:
        print(linea)
    registros.extend(regs)
    errores.extend(errs)
    return registros, errores


# ============================================================
# GUARDAR EXCEL
# ============================================================

def guardar_excel(df, df_errores):
    with pd.ExcelWriter(SALIDA, engine="openpyxl") as writer:

        df.to_excel(writer, sheet_name=HOJA_DATOS, index=False)
        df_errores.to_excel(writer, sheet_name=HOJA_ERRORES, index=False)

        # ------------------ Formato HP_CARGA ------------------
        hoja = writer.book[HOJA_DATOS]
        hoja.freeze_panes = "A2"
        hoja.auto_filter.ref = hoja.dimensions

        # Fecha (A) y Peso (I) en una sola pasada
        for fila in hoja.iter_rows(min_row=2, max_col=9):
            if fila[0].value is not None:
                fila[0].number_format = "dd/mm/yyyy"
            if fila[8].value is not None:
                fila[8].number_format = "#,##0.00"

        anchos_hp = {
            "A": 14, "B": 18, "C": 30, "D": 30, "E": 30,
            "F": 32, "G": 65, "H": 35, "I": 18, "J": 35,
        }
        for columna, ancho in anchos_hp.items():
            hoja.column_dimensions[columna].width = ancho

        # ------------------ Formato ERRORES -------------------
        hoja_errores = writer.book[HOJA_ERRORES]
        hoja_errores.freeze_panes = "A2"

        if hoja_errores.max_row > 1:
            hoja_errores.auto_filter.ref = hoja_errores.dimensions

        anchos_errores = {"A": 35, "B": 12, "C": 12, "D": 12, "E": 22, "F": 120}
        for columna, ancho in anchos_errores.items():
            hoja_errores.column_dimensions[columna].width = ancho


# ============================================================
# PROGRAMA PRINCIPAL
# ============================================================

def main():
    todos_los_pdfs = sorted(CARPETA.glob("*.pdf"))

    opcion = seleccionar_modo()
    if opcion == "0":
        print()
        print("Proceso cancelado.")
        print()
        return

    # ---------------------- Modo -------------------------
    if opcion == "1":
        modo = "TOTAL"
        df_existente = pd.DataFrame(columns=COLUMNAS_SALIDA)
        df_errores_existentes = pd.DataFrame(columns=COLUMNAS_ERRORES)
        pdfs_a_procesar = todos_los_pdfs
    else:
        modo = "NUEVOS"
        df_existente, df_errores_existentes = leer_excel_existente()

        archivos_procesados = set(
            df_existente["Archivo"].dropna().astype(str).str.strip()
        )
        pdfs_a_procesar = [
            pdf for pdf in todos_los_pdfs
            if pdf.name not in archivos_procesados
        ]

    # ---------------------- Resumen ----------------------
    print()
    print("=" * 80)
    print("MODO: RECONSTRUIR TODO" if modo == "TOTAL" else "MODO: SOLO PDF NUEVOS")
    print("=" * 80)
    print(f"\nPDF existentes en carpeta: {len(todos_los_pdfs)}")
    if modo == "NUEVOS":
        print(f"PDF ya procesados: {len(todos_los_pdfs) - len(pdfs_a_procesar)}")
    print(f"PDF a procesar ahora: {len(pdfs_a_procesar)}")

    if modo == "NUEVOS" and not pdfs_a_procesar:
        print()
        print("No existen PDF nuevos.")
        print("El consolidado ya está actualizado.")
        print()
        return

    # ---------------------- Procesar ---------------------
    registros_nuevos, errores_nuevos = procesar_pdfs(pdfs_a_procesar)

    df_nuevos = pd.DataFrame(registros_nuevos, columns=COLUMNAS_SALIDA)
    df_errores_nuevos = pd.DataFrame(errores_nuevos, columns=COLUMNAS_ERRORES)

    if modo == "TOTAL":
        df = df_nuevos
        df_errores = df_errores_nuevos
    else:
        partes = [d for d in (df_existente, df_nuevos) if not d.empty]
        df = (
            pd.concat(partes, ignore_index=True)
            if partes
            else pd.DataFrame(columns=COLUMNAS_SALIDA)
        )

        partes_err = [d for d in (df_errores_existentes, df_errores_nuevos) if not d.empty]
        df_errores = (
            pd.concat(partes_err, ignore_index=True).drop_duplicates()
            if partes_err
            else pd.DataFrame(columns=COLUMNAS_ERRORES)
        )

    # ---------------------- Limpieza final ---------------
    if not df.empty:
        # Solo fecha, sin hora
        df["Fecha"] = pd.to_datetime(
            df["Fecha"], errors="coerce", dayfirst=True
        ).dt.normalize()

        df["Peso bruto kg"] = pd.to_numeric(df["Peso bruto kg"], errors="coerce")

        antes = len(df)
        df = df.drop_duplicates(ignore_index=True)
        print()
        print(f"Duplicados eliminados: {antes - len(df)}")

    # ---------------------- Guardar ----------------------
    try:
        guardar_excel(df, df_errores)
    except PermissionError:
        print()
        print("=" * 80)
        print("ERROR")
        print("=" * 80)
        print()
        print("No se pudo actualizar el Excel.")
        print("Probablemente HP_CARGA_CONSOLIDADO.xlsx está abierto.")
        print()
        print("Cierre el archivo de Excel y vuelva a ejecutar el programa.")
        print()
        raise SystemExit(1)

    # ---------------------- Resultado --------------------
    print()
    print("=" * 80)
    print("PROCESO TERMINADO")
    print("=" * 80)
    print()
    print(
        "Tipo de actualización: COMPLETA"
        if modo == "TOTAL"
        else "Tipo de actualización: SOLO NUEVOS"
    )
    print(f"\nPDF procesados en esta ejecución: {len(pdfs_a_procesar)}")
    print(f"Registros nuevos extraídos: {len(df_nuevos):,}")
    print(f"Registros totales en HP_CARGA: {len(df):,}")
    print(f"PDF registrados actualmente: {df['Archivo'].nunique() if not df.empty else 0}")
    print(f"Filas en ERRORES_ESTRUCTURA: {len(df_errores):,}")
    print()
    print("Excel actualizado:")
    print(SALIDA)
    print()


# Obligatorio en Windows para usar procesos en paralelo
if __name__ == "__main__":
    main()
