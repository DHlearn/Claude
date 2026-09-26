# MineraGest · Gestión de proyectos mineros (MVP v1)

Aplicación web para gestionar proyectos mineros. Permite registrar:

- qué mineral se explota en cada proyecto o yacimiento;
- los requerimientos e insumos necesarios en las etapas de **exploración** y **explotación**;
- las tareas operativas.

También genera reportes descargables en **Excel (.xlsx)**.

Está hecha solo con **HTML5, CSS3 y JavaScript puro**, sin frameworks ni backend. Los datos se guardan en el `localStorage` del navegador.

## Cómo abrir la app

1. Descarga o clona este repositorio.
2. Abre `index.html` con doble clic en Chrome, Edge o Firefox. No necesitas servidor.
3. La primera vez se cargan **datos de ejemplo**: 4 proyectos (oro, cobre, zinc y plata), 32 insumos y 10 tareas.

> Se necesita **conexión a internet** para cargar las librerías desde el CDN (SheetJS para Excel y Chart.js para los gráficos). Sin conexión, la app sigue funcionando, pero sin gráficos ni descarga de Excel. En ese caso muestra un aviso.

Opcional, con servidor local: `python3 -m http.server 8000` y luego abre `http://localhost:8000`.

## Estructura

```
index.html          Estructura de todas las vistas
css/styles.css      Estilos, diseño responsive e impresión
js/app.js           Utilidades, navegación, dashboard, moneda y respaldo JSON
js/storage.js       Lectura y escritura en localStorage, importar/exportar y datos de ejemplo
js/minerales.js     Proyectos / minerales
js/insumos.js       Requerimientos e insumos por etapa
js/tareas.js        Formulario y tabla de tareas
js/reportes.js      Reportes, gráficos, exportación a Excel e impresión
```

## Módulos

| Módulo | Qué hace |
|---|---|
| **Inicio** | Indicadores: proyectos, minerales, tareas por estado y costo total de insumos. Muestra las últimas 5 tareas y los proyectos por etapa. |
| **Proyectos y minerales** | Registro de ubicación, mineral principal y secundarios, tipo de yacimiento, método de explotación, etapa, ley y reservas. Búsqueda y filtros por mineral y etapa. Al eliminar un proyecto se eliminan también sus insumos y tareas, con aviso previo. |
| **Requerimientos e insumos** | Las categorías cambian según la etapa (exploración o explotación). El costo total se calcula automáticamente. Filtros por proyecto, etapa y estado, con total filtrado. |
| **Tareas** | Formulario con validaciones: campos obligatorios y fecha límite no anterior a la de inicio. Filtros por estado, prioridad, proyecto y área. Las tareas vencidas se resaltan en rojo y el estado se cambia directamente desde la tabla. |
| **Reportes** | Proyectos por mineral, insumos por proyecto y etapa (con subtotales), y avance de tareas por estado, responsable y área. Filtros por fechas y proyecto, gráficos, botón «Descargar Excel» en cada reporte, «Exportar todo» (hojas Resumen, Proyectos, Insumos y Tareas) e impresión. |

En la barra lateral puedes:

- elegir la **moneda** (USD o S/);
- **respaldar** todos los datos en JSON;
- **importar** un respaldo;
- **restablecer** los datos de ejemplo.

Cambiar la moneda solo cambia el símbolo mostrado; no convierte los montos.

## Cómo probarla

1. **Tareas:** pulsa «Agregar tarea» con el formulario vacío. Deben marcarse en rojo los campos obligatorios. Pon una fecha límite anterior a la de inicio y verás el error correspondiente. Después cambia el estado de una tarea vencida a «Completada» desde la tabla: deja de verse en rojo.
2. **Insumos:** elige la etapa (las categorías cambian), escribe cantidad y costo unitario, y comprueba que el costo total se calcula solo.
3. **Reportes:** filtra por proyecto o por fechas, descarga cada Excel y usa «Exportar todo». Los archivos se nombran con la fecha, por ejemplo `reporte_minero_2026-09-26.xlsx`, y las cabeceras van en negrita.
4. **Respaldo:** descarga el JSON, pulsa «Restablecer datos de ejemplo» y vuelve a importar el JSON.
5. **Responsive:** reduce el ancho de la ventana. La barra lateral pasa a un menú tipo hamburguesa.

## Nota sobre la librería de Excel

Para que las cabeceras salgan en negrita y con color se usa `xlsx-js-style`. Es una variante de SheetJS con la misma API, pero que sí aplica estilos de celda (SheetJS estándar no lo hace en su versión gratuita).

Si esa librería no carga, la app usa automáticamente SheetJS estándar (`https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js`). En ese caso los Excel se generan igual, pero sin formato de estilos.

## Propuestas para la versión 2

- **Backend y base de datos:** API REST con Node.js + Express y PostgreSQL (o MySQL), para compartir los datos entre usuarios y dispositivos.
- **Login con roles:** administrador, jefe de proyecto, supervisor y operador, cada uno con permisos por módulo.
- **Control de inventario:** entradas y salidas de almacén, stock mínimo con alertas, consumo real frente a presupuesto, y kardex de explosivos según la normativa.
- **Geolocalización:** mapa con Leaflet y OpenStreetMap para ubicar concesiones, sondajes y labores, e importar KML/GeoJSON.
- **Adjuntos:** estudios, permisos (DIA, EIA) y fotos de campo vinculados a cada proyecto o tarea.
- **Notificaciones:** correos o avisos de tareas próximas a vencer y de insumos por reponer.
- **Tablero avanzado:** tendencias mensuales de costos, producción frente a plan y comparación entre proyectos.
- **PWA sin conexión:** incluir las librerías localmente y sincronizar al recuperar la conexión.
