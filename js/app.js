/* ==========================================================================
   MineraGest - app.js
   Utilidades compartidas, navegación entre vistas, dashboard,
   configuración (moneda, respaldo JSON) e inicialización.
   ========================================================================== */
'use strict';

/* ---------- Utilidades compartidas ---------- */
const Util = {
  /** Escapa texto para insertarlo de forma segura en HTML. */
  esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  generarId(prefijo) {
    return `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  },

  /** Convierte una fecha a texto AAAA-MM-DD según la hora local. */
  fechaISO(fecha) {
    const dosDigitos = n => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
  },

  hoyISO() {
    return Util.fechaISO(new Date());
  },

  sumarDias(cantidad) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + cantidad);
    return Util.fechaISO(fecha);
  },

  /** Fecha AAAA-MM-DD de un registro a partir de su marca "creado". */
  fechaRegistro(registro) {
    return registro.creado ? Util.fechaISO(new Date(registro.creado)) : '';
  },

  formatoFecha(iso) {
    if (!iso) return '—';
    const [anio, mes, dia] = iso.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  },

  codigoMoneda() {
    return Almacen.datos.config.moneda === 'PEN' ? 'PEN' : 'USD';
  },

  simboloMoneda() {
    return Util.codigoMoneda() === 'PEN' ? 'S/' : 'USD';
  },

  formatoMoneda(valor) {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency', currency: Util.codigoMoneda(), minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Number(valor) || 0);
  },

  formatoNumero(valor, decimales = 2) {
    return new Intl.NumberFormat('es-PE', { maximumFractionDigits: decimales }).format(Number(valor) || 0);
  },

  redondear(valor, decimales = 2) {
    const factor = 10 ** decimales;
    return Math.round((Number(valor) || 0) * factor) / factor;
  },

  /** "En progreso" -> "en-progreso" (para clases CSS). */
  slug(texto) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  },

  badge(texto, grupo) {
    return `<span class="badge badge-${grupo}-${Util.slug(texto)}">${Util.esc(texto)}</span>`;
  },

  /** Botones de editar y eliminar para una fila de tabla. */
  botonesAccion(id, nombre) {
    const idSeguro = Util.esc(id);
    const nombreSeguro = Util.esc(nombre);
    return `<button type="button" class="btn-icono" data-accion="editar" data-id="${idSeguro}" aria-label="Editar ${nombreSeguro}" title="Editar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg></button>
      <button type="button" class="btn-icono btn-icono-peligro" data-accion="eliminar" data-id="${idSeguro}" aria-label="Eliminar ${nombreSeguro}" title="Eliminar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>`;
  },

  esVencida(tarea) {
    return tarea.estado !== 'Completada' && Boolean(tarea.fechaLimite) && tarea.fechaLimite < Util.hoyISO();
  },

  nombreProyecto(id) {
    const proyecto = Almacen.buscar('proyectos', id);
    return proyecto ? proyecto.nombre : '(proyecto eliminado)';
  },

  /** Llena un <select> con opciones; conserva el valor seleccionado si sigue existiendo. */
  llenarSelect(select, opciones, textoVacio) {
    const valorPrevio = select.value;
    const html = [];
    if (textoVacio !== undefined) html.push(`<option value="">${Util.esc(textoVacio)}</option>`);
    opciones.forEach(op => {
      const valor = typeof op === 'object' ? op.valor : op;
      const texto = typeof op === 'object' ? op.texto : op;
      html.push(`<option value="${Util.esc(valor)}">${Util.esc(texto)}</option>`);
    });
    select.innerHTML = html.join('');
    if ([...select.options].some(o => o.value === valorPrevio)) select.value = valorPrevio;
  },

  opcionesProyectos() {
    return Almacen.listar('proyectos')
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(p => ({ valor: p.id, texto: p.nombre }));
  },

  /* ----- Validación de formularios ----- */

  /** Revisa los campos con atributo data-requerido y marca los vacíos. */
  validarRequeridos(formulario) {
    let valido = true;
    formulario.querySelectorAll('[data-requerido]').forEach(campo => {
      if (!String(campo.value).trim()) {
        Util.marcarError(campo, 'Este campo es obligatorio.');
        valido = false;
      }
    });
    return valido;
  },

  marcarError(campo, mensaje) {
    const contenedor = campo.closest('.campo');
    if (!contenedor) return;
    contenedor.classList.add('con-error');
    const mensajeError = contenedor.querySelector('.msg-error');
    if (mensajeError) mensajeError.textContent = mensaje;
    campo.setAttribute('aria-invalid', 'true');
  },

  limpiarErrores(formulario) {
    formulario.querySelectorAll('.con-error').forEach(c => c.classList.remove('con-error'));
    formulario.querySelectorAll('.msg-error').forEach(m => { m.textContent = ''; });
    formulario.querySelectorAll('[aria-invalid]').forEach(c => c.removeAttribute('aria-invalid'));
  },

  enfocarPrimerError(formulario) {
    const campo = formulario.querySelector('.con-error input, .con-error select, .con-error textarea');
    if (campo) campo.focus();
  },

  /* ----- Notificaciones y diálogos ----- */

  toast(mensaje, tipo = 'exito') {
    const contenedor = document.getElementById('toasts');
    const aviso = document.createElement('div');
    aviso.className = `toast toast-${tipo}`;
    aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    aviso.textContent = mensaje;
    contenedor.appendChild(aviso);
    requestAnimationFrame(() => aviso.classList.add('visible'));
    setTimeout(() => {
      aviso.classList.remove('visible');
      setTimeout(() => aviso.remove(), 300);
    }, 3500);
  },

  /** Muestra un diálogo de confirmación. Devuelve una promesa con true/false. */
  confirmar(mensaje, titulo = 'Confirmar eliminación', textoBoton = 'Eliminar') {
    const dialogo = document.getElementById('dialogo-confirmar');
    dialogo.querySelector('#dialogo-titulo').textContent = titulo;
    dialogo.querySelector('#dialogo-mensaje').textContent = mensaje;
    dialogo.querySelector('#dialogo-aceptar').textContent = textoBoton;
    return new Promise(resolver => {
      const alCerrar = () => {
        dialogo.removeEventListener('close', alCerrar);
        resolver(dialogo.returnValue === 'aceptar');
      };
      dialogo.addEventListener('close', alCerrar);
      dialogo.returnValue = '';
      dialogo.showModal();
    });
  },

  descargarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

/* ---------- Dashboard (inicio) ---------- */
const Dashboard = {
  render() {
    const proyectos = Almacen.listar('proyectos');
    const insumos = Almacen.listar('insumos');
    const tareas = Almacen.listar('tareas');

    const minerales = new Set();
    proyectos.forEach(p => {
      minerales.add(p.mineralPrincipal);
      (p.mineralesSecundarios || []).forEach(m => minerales.add(m));
    });
    const contar = estado => tareas.filter(t => t.estado === estado).length;
    const costoTotal = insumos.reduce((suma, i) => suma + (Number(i.cantidad) * Number(i.costoUnitario) || 0), 0);
    const vencidas = tareas.filter(Util.esVencida).length;

    const tarjetas = [
      { titulo: 'Proyectos', valor: proyectos.length, detalle: 'unidades y yacimientos', clase: 'kpi-cobre' },
      { titulo: 'Minerales registrados', valor: minerales.size, detalle: 'principales y secundarios', clase: 'kpi-dorado' },
      { titulo: 'Tareas pendientes', valor: contar('Pendiente'), detalle: vencidas ? `${vencidas} vencida(s) en total` : 'sin tareas vencidas', clase: vencidas ? 'kpi-alerta' : '' },
      { titulo: 'Tareas en progreso', valor: contar('En progreso'), detalle: 'en ejecución', clase: '' },
      { titulo: 'Tareas completadas', valor: contar('Completada'), detalle: tareas.length ? `${Math.round(contar('Completada') / tareas.length * 100)}% de avance` : 'sin tareas', clase: '' },
      { titulo: 'Costo total de insumos', valor: Util.formatoMoneda(costoTotal), detalle: `${insumos.length} insumos registrados`, clase: 'kpi-oscuro' }
    ];

    document.getElementById('kpis').innerHTML = tarjetas.map(t => `
      <article class="kpi ${t.clase}">
        <h3>${Util.esc(t.titulo)}</h3>
        <p class="kpi-valor">${Util.esc(t.valor)}</p>
        <p class="kpi-detalle">${Util.esc(t.detalle)}</p>
      </article>`).join('');

    const ultimas = tareas.slice().sort((a, b) => String(b.creado).localeCompare(String(a.creado))).slice(0, 5);
    const cuerpo = document.getElementById('ultimas-tareas');
    cuerpo.innerHTML = ultimas.length ? ultimas.map(t => `
      <tr class="${Util.esVencida(t) ? 'fila-vencida' : ''}">
        <td><strong>${Util.esc(t.titulo)}</strong></td>
        <td>${Util.esc(Util.nombreProyecto(t.proyectoId))}</td>
        <td>${Util.esc(t.responsable)}</td>
        <td>${Util.badge(t.prioridad, 'prioridad')}</td>
        <td>${Util.formatoFecha(t.fechaLimite)}${Util.esVencida(t) ? ' <span class="etiqueta-vencida">Vencida</span>' : ''}</td>
        <td>${Util.badge(t.estado, 'estado')}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="vacio">Aún no hay tareas registradas.</td></tr>';

    // Resumen de proyectos por etapa
    const etapas = ['Exploración', 'Desarrollo', 'Explotación', 'Cierre'];
    document.getElementById('resumen-etapas').innerHTML = etapas.map(etapa => {
      const cantidad = proyectos.filter(p => p.etapa === etapa).length;
      return `<li><span>${Util.badge(etapa, 'etapa')}</span><strong>${cantidad}</strong></li>`;
    }).join('');
  }
};

/* ---------- Aplicación: navegación y configuración ---------- */
const App = {
  vistas: ['inicio', 'proyectos', 'insumos', 'tareas', 'reportes'],
  vistaActual: 'inicio',

  init() {
    Almacen.cargar();
    Proyectos.init();
    Insumos.init();
    Tareas.init();
    Reportes.init();
    this.configurarNavegacion();
    this.configurarAjustes();

    const vistaInicial = location.hash.replace('#', '');
    this.navegar(this.vistas.includes(vistaInicial) ? vistaInicial : 'inicio', false);
  },

  configurarNavegacion() {
    document.querySelectorAll('[data-vista]').forEach(boton => {
      boton.addEventListener('click', () => this.navegar(boton.dataset.vista));
    });
    window.addEventListener('hashchange', () => {
      const vista = location.hash.replace('#', '');
      if (this.vistas.includes(vista) && vista !== this.vistaActual) this.navegar(vista, false);
    });

    const cuerpo = document.body;
    document.getElementById('btn-menu').addEventListener('click', () => {
      const abierto = cuerpo.classList.toggle('menu-abierto');
      document.getElementById('btn-menu').setAttribute('aria-expanded', String(abierto));
    });
    document.getElementById('capa-menu').addEventListener('click', () => this.cerrarMenu());
    document.addEventListener('keydown', evento => {
      if (evento.key === 'Escape') this.cerrarMenu();
    });
  },

  cerrarMenu() {
    document.body.classList.remove('menu-abierto');
    document.getElementById('btn-menu').setAttribute('aria-expanded', 'false');
  },

  navegar(vista, actualizarHash = true) {
    this.vistaActual = vista;
    document.querySelectorAll('.vista').forEach(seccion => {
      seccion.hidden = seccion.id !== `vista-${vista}`;
    });
    document.querySelectorAll('.nav-item').forEach(boton => {
      const activo = boton.dataset.vista === vista;
      boton.classList.toggle('activo', activo);
      if (activo) boton.setAttribute('aria-current', 'page'); else boton.removeAttribute('aria-current');
    });
    const titulo = document.querySelector(`.nav-item[data-vista="${vista}"] .nav-texto`);
    document.getElementById('titulo-vista').textContent = titulo ? titulo.textContent : 'MineraGest';
    if (actualizarHash) history.replaceState(null, '', `#${vista}`);
    this.cerrarMenu();
    this.refrescarVista();
    window.scrollTo({ top: 0 });
  },

  /** Vuelve a dibujar la vista visible (se llama tras cualquier cambio de datos). */
  refrescarVista() {
    switch (this.vistaActual) {
      case 'proyectos': Proyectos.render(); break;
      case 'insumos': Insumos.render(); break;
      case 'tareas': Tareas.render(); break;
      case 'reportes': Reportes.render(); break;
      default: Dashboard.render();
    }
  },

  configurarAjustes() {
    const selectMoneda = document.getElementById('config-moneda');
    selectMoneda.value = Util.codigoMoneda();
    selectMoneda.addEventListener('change', () => {
      Almacen.configurar('moneda', selectMoneda.value);
      document.querySelectorAll('.simbolo-moneda').forEach(e => { e.textContent = Util.simboloMoneda(); });
      this.refrescarVista();
      Util.toast(`Moneda cambiada a ${selectMoneda.value === 'PEN' ? 'soles (S/)' : 'dólares (USD)'}.`);
    });
    document.querySelectorAll('.simbolo-moneda').forEach(e => { e.textContent = Util.simboloMoneda(); });

    document.getElementById('btn-respaldar').addEventListener('click', () => {
      Almacen.exportarJSON();
      Util.toast('Respaldo JSON descargado.');
    });

    const archivo = document.getElementById('archivo-importar');
    document.getElementById('btn-importar').addEventListener('click', () => archivo.click());
    archivo.addEventListener('change', async () => {
      const seleccionado = archivo.files[0];
      archivo.value = '';
      if (!seleccionado) return;
      const confirmado = await Util.confirmar(
        'Importar un respaldo reemplazará TODOS los datos actuales (proyectos, insumos y tareas). ¿Deseas continuar?',
        'Importar respaldo', 'Importar'
      );
      if (!confirmado) return;
      try {
        Almacen.importarJSON(await seleccionado.text());
        this.recargarTodo();
        Util.toast('Datos importados correctamente.');
      } catch (error) {
        Util.toast(error.message, 'error');
      }
    });

    document.getElementById('btn-restablecer').addEventListener('click', async () => {
      const confirmado = await Util.confirmar(
        'Se borrarán todos los datos actuales y se cargarán los datos de ejemplo. ¿Deseas continuar?',
        'Restablecer datos de ejemplo', 'Restablecer'
      );
      if (!confirmado) return;
      Almacen.restablecer();
      this.recargarTodo();
      Util.toast('Datos de ejemplo restablecidos.');
    });
  },

  recargarTodo() {
    document.getElementById('config-moneda').value = Util.codigoMoneda();
    document.querySelectorAll('.simbolo-moneda').forEach(e => { e.textContent = Util.simboloMoneda(); });
    Proyectos.cancelarEdicion();
    Insumos.cancelarEdicion();
    Tareas.cancelarEdicion();
    this.refrescarVista();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
