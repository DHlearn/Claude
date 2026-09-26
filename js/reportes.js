/* ==========================================================================
   MineraGest - reportes.js
   Reportes con filtros (fechas y proyecto), gráficos con Chart.js,
   exportación a Excel con SheetJS e impresión.
   ========================================================================== */
'use strict';

/* Colores de los gráficos (validados para daltonismo y contraste). */
const ColoresGrafico = {
  exploracion: '#2F6FA3',
  explotacion: '#B87333',
  estados: { 'Pendiente': '#B8923A', 'En progreso': '#2F6FA3', 'Completada': '#A8552E' },
  barra: '#B87333',
  texto: '#4a4f57',
  rejilla: '#e6e2dc'
};

/* ---------- Exportación a Excel ---------- */
const Excel = {
  estiloCabecera: {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'B87333' } },
    alignment: { vertical: 'center', wrapText: true }
  },
  estiloResaltado: {
    font: { bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'F3E7DA' } }
  },
  estiloTitulo: { font: { bold: true, sz: 14 } },

  disponible() {
    if (typeof XLSX === 'undefined') {
      Util.toast('No se pudo cargar la librería de Excel (SheetJS). Verifica tu conexión a internet y recarga la página.', 'error');
      return false;
    }
    return true;
  },

  /**
   * Crea una hoja a partir de filas (arreglo de arreglos).
   * opciones.cabeceras: índices de filas de cabecera (negrita con fondo cobre)
   * opciones.resaltadas: índices de filas de subtotal/total (negrita)
   * opciones.moneda: índices de columnas con formato de moneda
   */
  crearHoja(filas, opciones = {}) {
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    const cabeceras = opciones.cabeceras || [0];
    const resaltadas = opciones.resaltadas || [];
    const moneda = opciones.moneda || [];
    const titulos = opciones.titulos || [];
    const formatoMoneda = `"${Util.simboloMoneda()} "#,##0.00`;

    filas.forEach((fila, r) => {
      fila.forEach((valor, c) => {
        const celda = hoja[XLSX.utils.encode_cell({ r, c })];
        if (!celda) return;
        // Cada celda recibe su propia copia del estilo (la librería lo modifica al aplicar formatos)
        const copiar = estilo => JSON.parse(JSON.stringify(estilo));
        if (cabeceras.includes(r)) celda.s = copiar(this.estiloCabecera);
        else if (resaltadas.includes(r)) celda.s = copiar(this.estiloResaltado);
        else if (titulos.includes(r)) celda.s = copiar(this.estiloTitulo);
        if (typeof valor === 'number' && moneda.includes(c) && !cabeceras.includes(r)) celda.z = formatoMoneda;
      });
    });

    // Ancho de columnas según el contenido más largo
    const columnas = Math.max(...filas.map(f => f.length));
    hoja['!cols'] = Array.from({ length: columnas }, (_, c) => {
      const largo = Math.max(...filas.map(f => String(f[c] ?? '').length));
      return { wch: Math.min(Math.max(largo + 2, 10), 60) };
    });
    return hoja;
  },

  /** hojas: [{ nombre, hoja }] */
  descargar(hojas, nombreBase) {
    const libro = XLSX.utils.book_new();
    hojas.forEach(h => XLSX.utils.book_append_sheet(libro, h.hoja, h.nombre.slice(0, 31)));
    const nombre = `${nombreBase}_${Util.hoyISO()}.xlsx`;
    XLSX.writeFile(libro, nombre);
    Util.toast(`Archivo descargado: ${nombre}`);
  }
};

/* ---------- Reportes ---------- */
const Reportes = {
  graficos: {},

  init() {
    ['rep-desde', 'rep-hasta', 'rep-proyecto'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.render());
    });
    document.getElementById('btn-rep-limpiar').addEventListener('click', () => {
      document.getElementById('rep-desde').value = '';
      document.getElementById('rep-hasta').value = '';
      document.getElementById('rep-proyecto').value = '';
      this.render();
    });
    document.getElementById('btn-exportar-todo').addEventListener('click', () => this.exportarTodo());
    document.getElementById('btn-imprimir-todo').addEventListener('click', () => this.imprimir());

    document.getElementById('vista-reportes').addEventListener('click', evento => {
      const botonExcel = evento.target.closest('[data-excel]');
      if (botonExcel) this.exportar(botonExcel.dataset.excel);
      const botonImprimir = evento.target.closest('[data-imprimir]');
      if (botonImprimir) this.imprimir(botonImprimir.dataset.imprimir);
    });

    window.addEventListener('afterprint', () => {
      document.body.classList.remove('imprimir-uno');
      document.querySelectorAll('.imprimir-este').forEach(e => e.classList.remove('imprimir-este'));
    });
  },

  /* ----- Filtros ----- */

  filtros() {
    return {
      desde: document.getElementById('rep-desde').value,
      hasta: document.getElementById('rep-hasta').value,
      proyecto: document.getElementById('rep-proyecto').value
    };
  },

  enRango(fecha, f) {
    if (!f.desde && !f.hasta) return true;
    if (!fecha) return false;
    return (!f.desde || fecha >= f.desde) && (!f.hasta || fecha <= f.hasta);
  },

  /** Datos filtrados por fechas y proyecto. */
  datosFiltrados() {
    const f = this.filtros();
    return {
      proyectos: Almacen.listar('proyectos').filter(p =>
        (!f.proyecto || p.id === f.proyecto) && this.enRango(p.fechaInicio, f)),
      insumos: Almacen.listar('insumos').filter(i =>
        (!f.proyecto || i.proyectoId === f.proyecto) && this.enRango(Util.fechaRegistro(i), f)),
      tareas: Almacen.listar('tareas').filter(t =>
        (!f.proyecto || t.proyectoId === f.proyecto) && this.enRango(t.fechaInicio, f))
    };
  },

  descripcionFiltros() {
    const f = this.filtros();
    const partes = [];
    if (f.proyecto) partes.push(`Proyecto: ${Util.nombreProyecto(f.proyecto)}`);
    if (f.desde || f.hasta) partes.push(`Periodo: ${f.desde ? Util.formatoFecha(f.desde) : 'inicio'} al ${f.hasta ? Util.formatoFecha(f.hasta) : 'hoy'}`);
    return partes.length ? partes.join(' · ') : 'Sin filtros (todos los registros)';
  },

  /* ----- Cálculos ----- */

  calcularPorMineral(proyectos) {
    const grupos = new Map();
    proyectos.forEach(p => {
      const g = grupos.get(p.mineralPrincipal) || { mineral: p.mineralPrincipal, cantidad: 0, reservas: 0, nombres: [] };
      g.cantidad += 1;
      g.reservas += Number(p.reservas) || 0;
      g.nombres.push(p.nombre);
      grupos.set(p.mineralPrincipal, g);
    });
    return [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad || b.reservas - a.reservas);
  },

  /** Agrupa insumos por proyecto y etapa con subtotales. */
  calcularInsumos(insumos) {
    const porProyecto = new Map();
    insumos.forEach(i => {
      if (!porProyecto.has(i.proyectoId)) {
        porProyecto.set(i.proyectoId, { id: i.proyectoId, nombre: Util.nombreProyecto(i.proyectoId), etapas: { 'Exploración': [], 'Explotación': [] } });
      }
      const grupo = porProyecto.get(i.proyectoId);
      (grupo.etapas[i.etapa] || (grupo.etapas[i.etapa] = [])).push(i);
    });
    const proyectos = [...porProyecto.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    proyectos.forEach(p => {
      p.subtotales = {};
      Object.keys(p.etapas).forEach(etapa => {
        p.etapas[etapa].sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
        p.subtotales[etapa] = p.etapas[etapa].reduce((s, i) => s + Insumos.costoTotal(i), 0);
      });
      p.total = Object.values(p.subtotales).reduce((s, v) => s + v, 0);
    });
    const totalGeneral = proyectos.reduce((s, p) => s + p.total, 0);
    return { proyectos, totalGeneral };
  },

  resumenTareas(tareas, clave) {
    const grupos = new Map();
    tareas.forEach(t => {
      const nombre = t[clave] || '(sin asignar)';
      const g = grupos.get(nombre) || { nombre, total: 0, 'Pendiente': 0, 'En progreso': 0, 'Completada': 0, vencidas: 0 };
      g.total += 1;
      g[t.estado] = (g[t.estado] || 0) + 1;
      if (Util.esVencida(t)) g.vencidas += 1;
      grupos.set(nombre, g);
    });
    return [...grupos.values()]
      .map(g => Object.assign(g, { avance: g.total ? Math.round(g['Completada'] / g.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  },

  /* ----- Render ----- */

  render() {
    Util.llenarSelect(document.getElementById('rep-proyecto'), Util.opcionesProyectos(), 'Todos los proyectos');
    const datos = this.datosFiltrados();
    document.getElementById('rep-ayuda').textContent =
      `${this.descripcionFiltros()}. Rango de fechas: proyectos por fecha de inicio, insumos por fecha de registro y tareas por fecha de inicio. «Exportar todo» descarga todos los datos sin filtros.`;
    this.renderMineral(datos.proyectos);
    this.renderInsumos(datos.insumos);
    this.renderTareas(datos.tareas);
  },

  renderMineral(proyectos) {
    const filas = this.calcularPorMineral(proyectos);
    const cuerpo = document.getElementById('tabla-rep-mineral');
    cuerpo.innerHTML = filas.length ? filas.map(f => `
      <tr>
        <td><span class="chip-mineral">${Util.esc(f.mineral)}</span></td>
        <td class="num">${f.cantidad}</td>
        <td class="num">${Util.formatoNumero(f.reservas, 0)}</td>
        <td>${Util.esc(f.nombres.join(', '))}</td>
      </tr>`).join('') : '<tr><td colspan="4" class="vacio">Sin proyectos para los filtros seleccionados.</td></tr>';
    const totalReservas = filas.reduce((s, f) => s + f.reservas, 0);
    document.getElementById('pie-rep-mineral').innerHTML = filas.length
      ? `<tr><td>Total</td><td class="num">${proyectos.length}</td><td class="num">${Util.formatoNumero(totalReservas, 0)}</td><td></td></tr>`
      : '';

    this.dibujarGrafico('graf-mineral', {
      type: 'bar',
      data: {
        labels: filas.map(f => f.mineral),
        datasets: [{ label: 'Proyectos', data: filas.map(f => f.cantidad), backgroundColor: ColoresGrafico.barra, borderRadius: 4, maxBarThickness: 44 }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: ColoresGrafico.texto }, grid: { color: ColoresGrafico.rejilla } },
          x: { ticks: { color: ColoresGrafico.texto }, grid: { display: false } }
        }
      }
    });
  },

  renderInsumos(insumos) {
    const { proyectos, totalGeneral } = this.calcularInsumos(insumos);
    const cuerpo = document.getElementById('tabla-rep-insumos');
    if (!proyectos.length) {
      cuerpo.innerHTML = '<tr><td colspan="8" class="vacio">Sin insumos para los filtros seleccionados.</td></tr>';
    } else {
      const html = [];
      proyectos.forEach(p => {
        html.push(`<tr class="fila-grupo"><td colspan="8">${Util.esc(p.nombre)}</td></tr>`);
        CatalogoInsumos.etapas.forEach(etapa => {
          const lista = p.etapas[etapa] || [];
          if (!lista.length) return;
          lista.forEach(i => html.push(`
            <tr>
              <td class="sangria">${Util.badge(etapa, 'etapa')}</td>
              <td>${Util.esc(i.categoria)}</td>
              <td>${Util.esc(i.descripcion)}</td>
              <td class="num">${Util.formatoNumero(i.cantidad)}</td>
              <td>${Util.esc(i.unidad)}</td>
              <td class="num">${Util.formatoMoneda(i.costoUnitario)}</td>
              <td class="num">${Util.formatoMoneda(Insumos.costoTotal(i))}</td>
              <td>${Util.badge(i.estado, 'insumo')}</td>
            </tr>`));
          html.push(`<tr class="fila-subtotal"><td colspan="6" class="num">Subtotal ${etapa.toLowerCase()}</td><td class="num">${Util.formatoMoneda(p.subtotales[etapa])}</td><td></td></tr>`);
        });
        html.push(`<tr class="fila-subtotal fila-subtotal-proyecto"><td colspan="6" class="num">Total ${Util.esc(p.nombre)}</td><td class="num">${Util.formatoMoneda(p.total)}</td><td></td></tr>`);
      });
      html.push(`<tr class="fila-total"><td colspan="6" class="num">TOTAL GENERAL</td><td class="num">${Util.formatoMoneda(totalGeneral)}</td><td></td></tr>`);
      cuerpo.innerHTML = html.join('');
    }

    this.dibujarGrafico('graf-insumos', {
      type: 'bar',
      data: {
        labels: proyectos.map(p => p.nombre),
        datasets: [
          { label: 'Exploración', data: proyectos.map(p => Util.redondear(p.subtotales['Exploración'] || 0)), backgroundColor: ColoresGrafico.exploracion, borderRadius: 4, borderSkipped: false, borderColor: '#ffffff', borderWidth: 1, maxBarThickness: 28 },
          { label: 'Explotación', data: proyectos.map(p => Util.redondear(p.subtotales['Explotación'] || 0)), backgroundColor: ColoresGrafico.explotacion, borderRadius: 4, borderSkipped: false, borderColor: '#ffffff', borderWidth: 1, maxBarThickness: 28 }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { position: 'top', align: 'start', labels: { color: ColoresGrafico.texto, boxWidth: 12, boxHeight: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Util.formatoMoneda(ctx.parsed.x)}` } }
        },
        scales: {
          x: { stacked: true, beginAtZero: true, ticks: { color: ColoresGrafico.texto, callback: v => this.abreviar(v) }, grid: { color: ColoresGrafico.rejilla } },
          y: { stacked: true, ticks: { color: ColoresGrafico.texto }, grid: { display: false } }
        }
      }
    });
  },

  renderTareas(tareas) {
    const total = tareas.length;
    const porEstado = CatalogoTareas.estados.map(estado => {
      const cantidad = tareas.filter(t => t.estado === estado).length;
      return { estado, cantidad, porcentaje: total ? Math.round(cantidad / total * 100) : 0 };
    });
    const completadas = porEstado.find(e => e.estado === 'Completada').cantidad;
    const vencidas = tareas.filter(Util.esVencida).length;
    document.getElementById('avance-global').textContent = total
      ? `· Avance general: ${Math.round(completadas / total * 100)}%${vencidas ? ` · ${vencidas} vencida(s)` : ''}`
      : '';

    document.getElementById('tabla-rep-estado').innerHTML = total ? porEstado.map(e => `
      <tr>
        <td><span class="muestra-color" style="background:${ColoresGrafico.estados[e.estado]}"></span>${Util.esc(e.estado)}</td>
        <td class="num">${e.cantidad}</td>
        <td class="num">${e.porcentaje}%</td>
      </tr>`).join('') + `<tr class="fila-total"><td>Total</td><td class="num">${total}</td><td class="num">100%</td></tr>`
      : '<tr><td colspan="3" class="vacio">Sin tareas para los filtros seleccionados.</td></tr>';

    const filaResumen = g => `
      <tr>
        <td>${Util.esc(g.nombre)}</td>
        <td class="num">${g.total}</td>
        <td class="num">${g['Pendiente']}</td>
        <td class="num">${g['En progreso']}</td>
        <td class="num">${g['Completada']}</td>
        <td class="num">${g.vencidas ? `<span class="etiqueta-vencida">${g.vencidas}</span>` : 0}</td>
        <td><div class="barra-avance" role="img" aria-label="${g.avance}% de avance"><span style="width:${g.avance}%"></span></div><small>${g.avance}%</small></td>
      </tr>`;
    const vacio = '<tr><td colspan="7" class="vacio">Sin tareas para los filtros seleccionados.</td></tr>';
    const porResponsable = this.resumenTareas(tareas, 'responsable');
    const porArea = this.resumenTareas(tareas, 'area');
    document.getElementById('tabla-rep-responsable').innerHTML = porResponsable.length ? porResponsable.map(filaResumen).join('') : vacio;
    document.getElementById('tabla-rep-area').innerHTML = porArea.length ? porArea.map(filaResumen).join('') : vacio;

    this.dibujarGrafico('graf-tareas', {
      type: 'doughnut',
      data: {
        labels: porEstado.map(e => e.estado),
        datasets: [{
          data: porEstado.map(e => e.cantidad),
          backgroundColor: porEstado.map(e => ColoresGrafico.estados[e.estado]),
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { color: ColoresGrafico.texto, boxWidth: 12, boxHeight: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} (${total ? Math.round(ctx.parsed / total * 100) : 0}%)` } }
        }
      }
    });
  },

  abreviar(valor) {
    const abs = Math.abs(valor);
    if (abs >= 1e6) return `${Util.formatoNumero(valor / 1e6, 1)} M`;
    if (abs >= 1e3) return `${Util.formatoNumero(valor / 1e3, 0)} mil`;
    return Util.formatoNumero(valor, 0);
  },

  dibujarGrafico(idCanvas, configuracion) {
    const lienzo = document.getElementById(idCanvas);
    if (!lienzo) return;
    if (this.graficos[idCanvas]) {
      this.graficos[idCanvas].destroy();
      delete this.graficos[idCanvas];
    }
    if (typeof Chart === 'undefined') {
      lienzo.parentElement.innerHTML = '<p class="vacio">No se pudo cargar Chart.js (se requiere conexión a internet). Los datos siguen disponibles en las tablas.</p>';
      return;
    }
    configuracion.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, configuracion.options);
    this.graficos[idCanvas] = new Chart(lienzo, configuracion);
  },

  /* ----- Excel ----- */

  cabeceraReporte(titulo) {
    return [[`MineraGest · ${titulo}`], [this.descripcionFiltros()], [`Generado: ${new Date().toLocaleString('es-PE')} · Moneda: ${Util.simboloMoneda()}`], []];
  },

  hojaPorMineral(proyectos, conCabecera = true) {
    const filas = this.calcularPorMineral(proyectos);
    const encabezado = conCabecera ? this.cabeceraReporte('Proyectos por mineral') : [];
    const inicio = encabezado.length;
    const datos = [
      ...encabezado,
      ['Mineral principal', 'N.° de proyectos', 'Reservas totales (t)', 'Proyectos'],
      ...filas.map(f => [f.mineral, f.cantidad, f.reservas, f.nombres.join(', ')]),
      ['Total', proyectos.length, filas.reduce((s, f) => s + f.reservas, 0), '']
    ];
    return Excel.crearHoja(datos, { cabeceras: [inicio], resaltadas: [datos.length - 1], titulos: conCabecera ? [0] : [] });
  },

  hojaInsumosAgrupados(insumos) {
    const { proyectos, totalGeneral } = this.calcularInsumos(insumos);
    const encabezado = this.cabeceraReporte('Insumos por proyecto y etapa');
    const datos = [...encabezado, ['Proyecto', 'Etapa', 'Categoría', 'Descripción', 'Cantidad', 'Unidad', 'Costo unitario', 'Costo total', 'Proveedor', 'Estado']];
    const cabeceras = [encabezado.length];
    const resaltadas = [];
    proyectos.forEach(p => {
      CatalogoInsumos.etapas.forEach(etapa => {
        const lista = p.etapas[etapa] || [];
        if (!lista.length) return;
        lista.forEach(i => datos.push([p.nombre, etapa, i.categoria, i.descripcion, Number(i.cantidad), i.unidad, Number(i.costoUnitario), Insumos.costoTotal(i), i.proveedor || '', i.estado]));
        resaltadas.push(datos.length);
        datos.push([p.nombre, `Subtotal ${etapa.toLowerCase()}`, '', '', '', '', '', Util.redondear(p.subtotales[etapa]), '', '']);
      });
      resaltadas.push(datos.length);
      datos.push([`Total ${p.nombre}`, '', '', '', '', '', '', Util.redondear(p.total), '', '']);
    });
    resaltadas.push(datos.length);
    datos.push(['TOTAL GENERAL', '', '', '', '', '', '', Util.redondear(totalGeneral), '', '']);
    return Excel.crearHoja(datos, { cabeceras, resaltadas, moneda: [6, 7], titulos: [0] });
  },

  hojaResumenTareas(filas, etiqueta) {
    const datos = [[etiqueta, 'Total', 'Pendientes', 'En progreso', 'Completadas', 'Vencidas', '% de avance'],
      ...filas.map(g => [g.nombre, g.total, g['Pendiente'], g['En progreso'], g['Completada'], g.vencidas, g.avance / 100])];
    const hoja = Excel.crearHoja(datos);
    filas.forEach((_, r) => {
      const celda = hoja[XLSX.utils.encode_cell({ r: r + 1, c: 6 })];
      if (celda) celda.z = '0%';
    });
    return hoja;
  },

  hojaDetalleProyectos(proyectos) {
    const datos = [
      ['Proyecto', 'Región', 'Provincia', 'Distrito', 'Mineral principal', 'Minerales secundarios', 'Tipo de yacimiento', 'Método de explotación', 'Etapa', 'Ley', 'Unidad de ley', 'Reservas (t)', 'Fecha de inicio', 'Observaciones'],
      ...proyectos.map(p => [p.nombre, p.region, p.provincia, p.distrito || '', p.mineralPrincipal, (p.mineralesSecundarios || []).join(', '),
        p.tipoYacimiento, p.metodo, p.etapa, p.ley === '' ? '' : Number(p.ley), p.unidadLey, p.reservas === '' ? '' : Number(p.reservas), Util.formatoFecha(p.fechaInicio), p.observaciones || ''])
    ];
    return Excel.crearHoja(datos);
  },

  hojaDetalleInsumos(insumos) {
    const datos = [
      ['Proyecto', 'Etapa', 'Categoría', 'Descripción', 'Cantidad', 'Unidad', 'Costo unitario', 'Costo total', 'Proveedor', 'Estado', 'Fecha de registro'],
      ...insumos.map(i => [Util.nombreProyecto(i.proyectoId), i.etapa, i.categoria, i.descripcion, Number(i.cantidad), i.unidad,
        Number(i.costoUnitario), Insumos.costoTotal(i), i.proveedor || '', i.estado, Util.formatoFecha(Util.fechaRegistro(i))])
    ];
    return Excel.crearHoja(datos, { moneda: [6, 7] });
  },

  hojaDetalleTareas(tareas) {
    const datos = [
      ['Título', 'Descripción', 'Proyecto', 'Etapa', 'Área', 'Responsable', 'Prioridad', 'Fecha de inicio', 'Fecha límite', 'Estado', 'Vencida'],
      ...tareas.map(t => [t.titulo, t.descripcion || '', Util.nombreProyecto(t.proyectoId), t.etapa, t.area, t.responsable, t.prioridad,
        Util.formatoFecha(t.fechaInicio), Util.formatoFecha(t.fechaLimite), t.estado, Util.esVencida(t) ? 'Sí' : 'No'])
    ];
    return Excel.crearHoja(datos);
  },

  exportar(tipo) {
    if (!Excel.disponible()) return;
    const datos = this.datosFiltrados();

    if (tipo === 'mineral') {
      Excel.descargar([
        { nombre: 'Proyectos por mineral', hoja: this.hojaPorMineral(datos.proyectos) },
        { nombre: 'Detalle proyectos', hoja: this.hojaDetalleProyectos(datos.proyectos) }
      ], 'reporte_proyectos_por_mineral');
    }

    if (tipo === 'insumos') {
      Excel.descargar([
        { nombre: 'Insumos por proyecto', hoja: this.hojaInsumosAgrupados(datos.insumos) }
      ], 'reporte_insumos');
    }

    if (tipo === 'tareas') {
      const total = datos.tareas.length;
      const encabezado = this.cabeceraReporte('Avance de tareas');
      const filasEstado = [...encabezado, ['Estado', 'Tareas', '%'],
        ...CatalogoTareas.estados.map(e => {
          const n = datos.tareas.filter(t => t.estado === e).length;
          return [e, n, total ? n / total : 0];
        }),
        ['Total', total, total ? 1 : 0]];
      const hojaEstado = Excel.crearHoja(filasEstado, { cabeceras: [encabezado.length], resaltadas: [filasEstado.length - 1], titulos: [0] });
      for (let r = encabezado.length + 1; r < filasEstado.length; r++) {
        const celda = hojaEstado[XLSX.utils.encode_cell({ r, c: 2 })];
        if (celda) celda.z = '0%';
      }
      Excel.descargar([
        { nombre: 'Por estado', hoja: hojaEstado },
        { nombre: 'Por responsable', hoja: this.hojaResumenTareas(this.resumenTareas(datos.tareas, 'responsable'), 'Responsable') },
        { nombre: 'Por área', hoja: this.hojaResumenTareas(this.resumenTareas(datos.tareas, 'area'), 'Área') },
        { nombre: 'Detalle tareas', hoja: this.hojaDetalleTareas(datos.tareas) }
      ], 'reporte_tareas');
    }
  },

  /** Exporta todos los datos (sin filtros) en un libro con varias hojas. */
  exportarTodo() {
    if (!Excel.disponible()) return;
    const proyectos = Almacen.listar('proyectos');
    const insumos = Almacen.listar('insumos');
    const tareas = Almacen.listar('tareas');

    const costoPorEtapa = etapa => insumos.filter(i => i.etapa === etapa).reduce((s, i) => s + Insumos.costoTotal(i), 0);
    const contar = estado => tareas.filter(t => t.estado === estado).length;
    const completadas = contar('Completada');

    const resumen = [
      ['MineraGest · Resumen general'],
      [`Generado: ${new Date().toLocaleString('es-PE')} · Moneda: ${Util.simboloMoneda()}`],
      [],
      ['Indicador', 'Valor'],
      ['Total de proyectos', proyectos.length],
      ['Tareas pendientes', contar('Pendiente')],
      ['Tareas en progreso', contar('En progreso')],
      ['Tareas completadas', completadas],
      ['Tareas vencidas', tareas.filter(Util.esVencida).length],
      ['Avance de tareas', tareas.length ? completadas / tareas.length : 0],
      ['Costo de insumos - Exploración', Util.redondear(costoPorEtapa('Exploración'))],
      ['Costo de insumos - Explotación', Util.redondear(costoPorEtapa('Explotación'))],
      ['Costo total de insumos', Util.redondear(costoPorEtapa('Exploración') + costoPorEtapa('Explotación'))],
      [],
      ['Mineral principal', 'N.° de proyectos', 'Reservas totales (t)'],
      ...this.calcularPorMineral(proyectos).map(f => [f.mineral, f.cantidad, f.reservas])
    ];
    const hojaResumen = Excel.crearHoja(resumen, { cabeceras: [3, 14], resaltadas: [12], titulos: [0] });
    const formatoMoneda = `"${Util.simboloMoneda()} "#,##0.00`;
    [10, 11, 12].forEach(r => { hojaResumen[XLSX.utils.encode_cell({ r, c: 1 })].z = formatoMoneda; });
    hojaResumen[XLSX.utils.encode_cell({ r: 9, c: 1 })].z = '0%';

    Excel.descargar([
      { nombre: 'Resumen', hoja: hojaResumen },
      { nombre: 'Proyectos', hoja: this.hojaDetalleProyectos(proyectos) },
      { nombre: 'Insumos', hoja: this.hojaDetalleInsumos(insumos) },
      { nombre: 'Tareas', hoja: this.hojaDetalleTareas(tareas) }
    ], 'reporte_minero');
  },

  /* ----- Impresión ----- */

  imprimir(idReporte) {
    if (idReporte) {
      document.body.classList.add('imprimir-uno');
      document.getElementById(idReporte).classList.add('imprimir-este');
    }
    // Ajusta los gráficos al ancho de la hoja antes de imprimir
    Object.values(this.graficos).forEach(g => g.resize());
    window.print();
  }
};
