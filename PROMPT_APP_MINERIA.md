# Prompt: Aplicativo web de gestión minera (v1)

Copia y pega el siguiente prompt en Claude Code (claude.ai/code):

---

Actúa como un desarrollador full-stack senior con experiencia en el sector minero. Crea la **versión 1** de un aplicativo web llamado **"MineralTrack"** usando únicamente **HTML5, CSS3 y JavaScript puro (vanilla)**, sin frameworks ni backend. Los datos deben guardarse en `localStorage` del navegador.

## Objetivo
Registrar y consultar qué **mineral** se explota en cada proyecto/unidad minera, qué **requerimientos e insumos** se necesitan para las etapas de **exploración** y **explotación**, gestionar **tareas** del equipo y generar **reportes descargables en Excel**.

## Estructura de archivos
```
/mineraltrack
  index.html
  /css/styles.css
  /js/app.js          (inicialización y navegación)
  /js/storage.js      (lectura/escritura en localStorage)
  /js/minerales.js    (catálogo de minerales e insumos)
  /js/tareas.js       (CRUD de tareas)
  /js/reportes.js     (reportes y exportación a Excel)
  README.md
```

## Módulos

### 1. Dashboard
- Tarjetas KPI: total de proyectos, minerales explotados, tareas pendientes / en progreso / completadas, costo total estimado de insumos.
- Gráficos con Chart.js (CDN): tareas por estado, costo de insumos por etapa (exploración vs. explotación) y proyectos por mineral.

### 2. Catálogo de minerales
Precarga estos minerales con datos de ejemplo: **Cobre, Oro, Plata, Zinc, Plomo, Hierro, Molibdeno, Litio, Estaño y Carbón**. Cada mineral tiene:
- Nombre, símbolo químico, tipo (metálico / no metálico / energético).
- Mena principal (ej. calcopirita para cobre), método de explotación típico (tajo abierto, subterráneo, lixiviación, aluvial).
- Principales usos y país/región de producción de referencia.
- Permite agregar, editar y eliminar minerales.

### 3. Requerimientos e insumos por etapa
Para cada mineral, lista los requerimientos separados en dos etapas:

**Exploración:** estudios geológicos y geofísicos, mapeo, muestreo, perforación diamantina / RC, análisis de laboratorio (ensayos), permisos (EIA/DIA, concesión, consulta previa), personal (geólogos, topógrafos), equipos (GPS, drones, perforadoras), campamento y logística.

**Explotación:** maquinaria (palas, camiones, perforadoras, cargadores, scoop), explosivos (ANFO, emulsiones, detonadores), combustibles y lubricantes, energía eléctrica, agua, reactivos de proceso (cianuro, cal, ácido sulfúrico, xantatos, espumantes según el mineral), acero de perforación, bolas de molienda, EPP, sostenimiento (pernos, malla, shotcrete), personal y seguridad, plan de cierre y gestión de relaves.

Cada insumo tiene: nombre, categoría (maquinaria, químico, explosivo, energía, personal, permiso, servicio, EPP), etapa, cantidad, unidad, costo unitario estimado (USD), proveedor y observaciones. El costo total se calcula automáticamente. Filtros por mineral, etapa y categoría.

### 4. Proyectos / Unidades mineras
- Nombre, ubicación (región/provincia), mineral principal y secundarios, etapa actual (exploración, desarrollo, explotación, cierre), fecha de inicio, responsable y producción estimada (t/día o oz/año).

### 5. Formulario de tareas (obligatorio)
Formulario para **agregar, editar, eliminar y marcar como completadas** tareas con los campos:
- Título*, descripción, proyecto asociado*, mineral, etapa (exploración / explotación)*, área (geología, perforación, voladura, carguío y acarreo, planta, seguridad, medio ambiente, logística), responsable*, prioridad (alta / media / baja), estado (pendiente / en progreso / completada), fecha de inicio, fecha límite*, insumos requeridos (selección múltiple desde el catálogo) y costo estimado.
- Validación en JavaScript con mensajes de error claros (campos obligatorios, fecha límite ≥ fecha de inicio, costo no negativo).
- Tabla de tareas con búsqueda, filtros (estado, prioridad, proyecto, etapa), ordenamiento por columna y paginación.
- Tareas vencidas resaltadas en rojo y por vencer (≤ 3 días) en amarillo.

### 6. Reportes y descarga en Excel
Usa **SheetJS (xlsx) desde CDN** para exportar a `.xlsx`. Reportes:
1. **Minerales explotados** por proyecto.
2. **Insumos por mineral y etapa** con subtotales y total general de costos.
3. **Tareas** (todas o filtradas) con estado, responsable y fechas.
4. **Tareas vencidas y pendientes** por responsable.
5. **Reporte consolidado**: un solo archivo Excel con varias hojas (Resumen, Minerales, Insumos, Proyectos, Tareas).

Cada reporte se ve primero en pantalla (vista previa en tabla) y tiene botón **"Descargar Excel"**. Los archivos llevan nombre con fecha, ej. `reporte_tareas_2026-09-26.xlsx`, encabezados en negrita y columnas con ancho ajustado. Agrega también un botón **"Imprimir / PDF"** usando `window.print()` con estilos `@media print`.

## Diseño (CSS)
- Tema industrial minero: gris carbón (#2B2D31), cobre (#B87333), dorado (#D4A017) y blanco; opción de modo oscuro/claro.
- Barra lateral de navegación con íconos, responsive (menú hamburguesa en móvil), diseño con CSS Grid/Flexbox.
- Tipografía legible (Google Fonts: Inter o Roboto), tablas con filas alternadas, badges de color para estado y prioridad.
- Accesibilidad: etiquetas `<label>`, contraste adecuado y navegación con teclado.

## Requisitos técnicos
- Código modular, comentado en español y con nombres de variables claros.
- Datos de ejemplo precargados la primera vez (3 proyectos, 10 minerales, insumos por etapa y 10 tareas).
- Botones para **exportar/importar respaldo en JSON** y para **restablecer datos de ejemplo**.
- Notificaciones tipo *toast* para confirmar acciones y confirmación antes de eliminar.
- Sin errores en la consola; funciona abriendo `index.html` directamente en el navegador.

## Entregables
1. Todos los archivos del proyecto con el código completo.
2. `README.md` en español con: descripción, cómo ejecutarlo, estructura, uso de cada módulo y hoja de ruta para la v2 (backend con Node.js/Express o Python, base de datos, login con roles, carga de documentos y mapas de concesiones).

Trabaja paso a paso: primero crea la estructura y el HTML, luego los estilos, después la lógica en JavaScript y por último prueba el formulario de tareas y la descarga de cada reporte en Excel. Al terminar, haz commit con un mensaje descriptivo.

---
