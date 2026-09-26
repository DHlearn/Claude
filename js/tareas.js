/* ==========================================================================
   MineraGest - tareas.js
   Formulario principal de tareas operativas, tabla con filtros,
   resaltado de tareas vencidas y cambio rápido de estado.
   ========================================================================== */
'use strict';

const CatalogoTareas = {
  etapas: ['Exploración', 'Explotación'],
  areas: ['Geología', 'Perforación', 'Voladura', 'Carguío y acarreo', 'Planta', 'Seguridad', 'Medio ambiente', 'Logística'],
  prioridades: ['Alta', 'Media', 'Baja'],
  estados: ['Pendiente', 'En progreso', 'Completada']
};

const Tareas = {
  formulario: null,

  init() {
    this.formulario = document.getElementById('form-tarea');
    const c = CatalogoTareas;

    Util.llenarSelect(document.getElementById('tar-etapa'), c.etapas, 'Seleccione…');
    Util.llenarSelect(document.getElementById('tar-area'), c.areas, 'Seleccione…');
    Util.llenarSelect(document.getElementById('tar-prioridad'), c.prioridades);
    Util.llenarSelect(document.getElementById('tar-estado'), c.estados);
    Util.llenarSelect(document.getElementById('tar-filtro-estado'), c.estados, 'Todos');
    Util.llenarSelect(document.getElementById('tar-filtro-prioridad'), c.prioridades, 'Todas');
    Util.llenarSelect(document.getElementById('tar-filtro-area'), c.areas, 'Todas');
    this.valoresPorDefecto();

    this.formulario.addEventListener('submit', evento => { evento.preventDefault(); this.guardar(); });
    document.getElementById('btn-tar-cancelar').addEventListener('click', () => this.cancelarEdicion());
    // La fecha límite no puede ser anterior a la de inicio
    document.getElementById('tar-inicio').addEventListener('change', evento => {
      document.getElementById('tar-limite').min = evento.target.value;
    });

    ['tar-buscar', 'tar-filtro-estado', 'tar-filtro-prioridad', 'tar-filtro-proyecto', 'tar-filtro-area', 'tar-solo-vencidas'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.renderTabla());
    });

    const tabla = document.getElementById('tabla-tareas');
    tabla.addEventListener('click', evento => {
      const boton = evento.target.closest('button[data-accion]');
      if (!boton) return;
      if (boton.dataset.accion === 'editar') this.editar(boton.dataset.id);
      if (boton.dataset.accion === 'eliminar') this.eliminar(boton.dataset.id);
    });
    // Cambio rápido de estado desde la tabla
    tabla.addEventListener('change', evento => {
      const select = evento.target.closest('select[data-estado-rapido]');
      if (!select) return;
      const tarea = Almacen.actualizar('tareas', select.dataset.estadoRapido, { estado: select.value });
      if (tarea) Util.toast(`«${tarea.titulo}» ahora está: ${tarea.estado}.`);
      this.renderTabla();
    });
  },

  valoresPorDefecto() {
    document.getElementById('tar-prioridad').value = 'Media';
    document.getElementById('tar-estado').value = 'Pendiente';
    document.getElementById('tar-inicio').value = Util.hoyISO();
    document.getElementById('tar-limite').min = Util.hoyISO();
  },

  render() {
    const proyectos = Util.opcionesProyectos();
    Util.llenarSelect(document.getElementById('tar-proyecto'), proyectos, proyectos.length ? 'Seleccione…' : 'Registre primero un proyecto');
    Util.llenarSelect(document.getElementById('tar-filtro-proyecto'), proyectos, 'Todos');
    const responsables = [...new Set(Almacen.listar('tareas').map(t => t.responsable).filter(Boolean))].sort();
    document.getElementById('lista-responsables').innerHTML = responsables.map(r => `<option value="${Util.esc(r)}">`).join('');
    this.renderTabla();
  },

  filtrar() {
    const texto = document.getElementById('tar-buscar').value.trim().toLowerCase();
    const estado = document.getElementById('tar-filtro-estado').value;
    const prioridad = document.getElementById('tar-filtro-prioridad').value;
    const proyecto = document.getElementById('tar-filtro-proyecto').value;
    const area = document.getElementById('tar-filtro-area').value;
    const soloVencidas = document.getElementById('tar-solo-vencidas').checked;

    return Almacen.listar('tareas').filter(t => {
      if (estado && t.estado !== estado) return false;
      if (prioridad && t.prioridad !== prioridad) return false;
      if (proyecto && t.proyectoId !== proyecto) return false;
      if (area && t.area !== area) return false;
      if (soloVencidas && !Util.esVencida(t)) return false;
      if (texto) {
        const contenido = [t.titulo, t.descripcion, t.responsable, t.area, Util.nombreProyecto(t.proyectoId)].join(' ').toLowerCase();
        if (!contenido.includes(texto)) return false;
      }
      return true;
    });
  },

  renderTabla() {
    const pesoEstado = { 'Pendiente': 0, 'En progreso': 1, 'Completada': 2 };
    const pesoPrioridad = { 'Alta': 0, 'Media': 1, 'Baja': 2 };
    // Orden: vencidas primero, luego por estado, fecha límite y prioridad
    const lista = this.filtrar().sort((a, b) =>
      Number(Util.esVencida(b)) - Number(Util.esVencida(a)) ||
      pesoEstado[a.estado] - pesoEstado[b.estado] ||
      String(a.fechaLimite).localeCompare(String(b.fechaLimite)) ||
      pesoPrioridad[a.prioridad] - pesoPrioridad[b.prioridad]);
    const total = Almacen.listar('tareas').length;
    const vencidas = Almacen.listar('tareas').filter(Util.esVencida).length;
    document.getElementById('tar-contador').textContent =
      `(${lista.length} de ${total}${vencidas ? ` · ${vencidas} vencida${vencidas > 1 ? 's' : ''}` : ''})`;

    const cuerpo = document.getElementById('tabla-tareas');
    if (!lista.length) {
      cuerpo.innerHTML = `<tr><td colspan="10" class="vacio">${total ? 'Ninguna tarea coincide con los filtros.' : 'Aún no hay tareas. Agrega la primera con el formulario.'}</td></tr>`;
      return;
    }
    cuerpo.innerHTML = lista.map(t => {
      const vencida = Util.esVencida(t);
      const opcionesEstado = CatalogoTareas.estados
        .map(e => `<option value="${e}"${e === t.estado ? ' selected' : ''}>${e}</option>`).join('');
      return `
      <tr class="${vencida ? 'fila-vencida' : ''}${t.estado === 'Completada' ? ' fila-completada' : ''}">
        <td><strong>${Util.esc(t.titulo)}</strong>${t.descripcion ? `<br><small class="texto-tenue">${Util.esc(t.descripcion)}</small>` : ''}</td>
        <td>${Util.esc(Util.nombreProyecto(t.proyectoId))}</td>
        <td>${Util.badge(t.etapa, 'etapa')}</td>
        <td>${Util.esc(t.area)}</td>
        <td>${Util.esc(t.responsable)}</td>
        <td>${Util.badge(t.prioridad, 'prioridad')}</td>
        <td>${Util.formatoFecha(t.fechaInicio)}</td>
        <td>${Util.formatoFecha(t.fechaLimite)}${vencida ? '<br><span class="etiqueta-vencida">Vencida</span>' : ''}</td>
        <td>
          <select class="estado-rapido estado-${Util.slug(t.estado)}" data-estado-rapido="${Util.esc(t.id)}" aria-label="Cambiar estado de ${Util.esc(t.titulo)}">${opcionesEstado}</select>
        </td>
        <td class="acciones-col">${Util.botonesAccion(t.id, t.titulo)}</td>
      </tr>`;
    }).join('');
  },

  leerFormulario() {
    const valor = id => document.getElementById(id).value.trim();
    return {
      titulo: valor('tar-titulo'),
      descripcion: valor('tar-descripcion'),
      proyectoId: valor('tar-proyecto'),
      etapa: valor('tar-etapa'),
      area: valor('tar-area'),
      responsable: valor('tar-responsable'),
      prioridad: valor('tar-prioridad'),
      fechaInicio: valor('tar-inicio'),
      fechaLimite: valor('tar-limite'),
      estado: valor('tar-estado')
    };
  },

  validar(datos) {
    Util.limpiarErrores(this.formulario);
    let valido = Util.validarRequeridos(this.formulario);
    if (datos.fechaInicio && datos.fechaLimite && datos.fechaLimite < datos.fechaInicio) {
      Util.marcarError(document.getElementById('tar-limite'), 'La fecha límite no puede ser anterior a la fecha de inicio.');
      valido = false;
    }
    if (!valido) Util.enfocarPrimerError(this.formulario);
    return valido;
  },

  guardar() {
    if (!Almacen.listar('proyectos').length) {
      Util.toast('Primero registra un proyecto en «Proyectos y minerales».', 'error');
      return;
    }
    const datos = this.leerFormulario();
    if (!this.validar(datos)) {
      Util.toast('Revisa los campos marcados en rojo.', 'error');
      return;
    }
    const id = document.getElementById('tar-id').value;
    if (id) {
      Almacen.actualizar('tareas', id, datos);
      Util.toast(`Tarea «${datos.titulo}» actualizada.`);
    } else {
      Almacen.agregar('tareas', datos);
      Util.toast(`Tarea «${datos.titulo}» agregada.`);
    }
    this.cancelarEdicion();
    this.render();
  },

  editar(id) {
    const t = Almacen.buscar('tareas', id);
    if (!t) return;
    this.cancelarEdicion();
    const asignar = (campo, valor) => { document.getElementById(campo).value = valor ?? ''; };
    asignar('tar-id', t.id);
    asignar('tar-titulo', t.titulo);
    asignar('tar-descripcion', t.descripcion);
    asignar('tar-proyecto', t.proyectoId);
    asignar('tar-etapa', t.etapa);
    asignar('tar-area', t.area);
    asignar('tar-responsable', t.responsable);
    asignar('tar-prioridad', t.prioridad);
    asignar('tar-inicio', t.fechaInicio);
    asignar('tar-limite', t.fechaLimite);
    asignar('tar-estado', t.estado);
    document.getElementById('tar-limite').min = t.fechaInicio || '';

    document.getElementById('titulo-form-tarea').textContent = `Editando tarea: ${t.titulo}`;
    document.getElementById('btn-tar-guardar').textContent = 'Guardar cambios';
    document.getElementById('btn-tar-cancelar').textContent = 'Cancelar edición';
    this.formulario.classList.add('editando');
    this.formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('tar-titulo').focus({ preventScroll: true });
  },

  cancelarEdicion() {
    this.formulario.reset();
    document.getElementById('tar-id').value = '';
    Util.limpiarErrores(this.formulario);
    this.valoresPorDefecto();
    document.getElementById('titulo-form-tarea').textContent = 'Nueva tarea operativa';
    document.getElementById('btn-tar-guardar').textContent = 'Agregar tarea';
    document.getElementById('btn-tar-cancelar').textContent = 'Limpiar';
    this.formulario.classList.remove('editando');
  },

  async eliminar(id) {
    const t = Almacen.buscar('tareas', id);
    if (!t) return;
    const confirmado = await Util.confirmar(`¿Eliminar la tarea «${t.titulo}»? Esta acción no se puede deshacer.`);
    if (!confirmado) return;
    Almacen.eliminar('tareas', id);
    if (document.getElementById('tar-id').value === id) this.cancelarEdicion();
    Util.toast('Tarea eliminada.', 'info');
    this.render();
  }
};
