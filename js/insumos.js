/* ==========================================================================
   MineraGest - insumos.js
   Requerimientos e insumos por proyecto para las etapas de exploración
   y explotación, con cálculo automático del costo total.
   ========================================================================== */
'use strict';

const CatalogoInsumos = {
  etapas: ['Exploración', 'Explotación'],
  categorias: {
    'Exploración': [
      'Geología y mapeo',
      'Geoquímica (muestreo)',
      'Geofísica',
      'Perforación diamantina/RC',
      'Laboratorio (ensayos)',
      'Topografía',
      'Permisos ambientales (DIA, EIA-sd)',
      'Permisos sociales (consulta previa)'
    ],
    'Explotación': [
      'Explosivos y accesorios',
      'Combustible',
      'Maquinaria y equipos',
      'Reactivos (cianuro, cal, xantatos, etc.)',
      'Agua',
      'Energía eléctrica',
      'EPP (equipos de protección personal)',
      'Repuestos',
      'Mano de obra',
      'Transporte',
      'Permisos (EIA, plan de minado, plan de cierre)'
    ]
  },
  estados: ['Requerido', 'Solicitado', 'En almacén', 'Consumido'],
  unidades: ['und', 'kg', 't', 'gal', 'L', 'm', 'm²', 'm³', 'kWh', 'muestra', 'h', 'día', 'mes', 'h-h', 'global']
};

const Insumos = {
  formulario: null,

  costoTotal(insumo) {
    return Util.redondear(Number(insumo.cantidad) * Number(insumo.costoUnitario));
  },

  init() {
    this.formulario = document.getElementById('form-insumo');
    const c = CatalogoInsumos;

    Util.llenarSelect(document.getElementById('ins-etapa'), c.etapas, 'Seleccione…');
    Util.llenarSelect(document.getElementById('ins-estado'), c.estados);
    Util.llenarSelect(document.getElementById('ins-filtro-etapa'), c.etapas, 'Todas');
    Util.llenarSelect(document.getElementById('ins-filtro-estado'), c.estados, 'Todos');
    document.getElementById('lista-unidades').innerHTML = c.unidades.map(u => `<option value="${Util.esc(u)}">`).join('');
    this.actualizarCategorias();

    document.getElementById('ins-etapa').addEventListener('change', () => this.actualizarCategorias());
    ['ins-cantidad', 'ins-costo'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.actualizarTotal());
    });
    this.formulario.addEventListener('submit', evento => { evento.preventDefault(); this.guardar(); });
    document.getElementById('btn-ins-cancelar').addEventListener('click', () => this.cancelarEdicion());

    ['ins-buscar', 'ins-filtro-proyecto', 'ins-filtro-etapa', 'ins-filtro-estado'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.renderTabla());
    });

    document.getElementById('tabla-insumos').addEventListener('click', evento => {
      const boton = evento.target.closest('button[data-accion]');
      if (!boton) return;
      if (boton.dataset.accion === 'editar') this.editar(boton.dataset.id);
      if (boton.dataset.accion === 'eliminar') this.eliminar(boton.dataset.id);
    });
  },

  /** Las categorías dependen de la etapa elegida. */
  actualizarCategorias() {
    const etapa = document.getElementById('ins-etapa').value;
    const select = document.getElementById('ins-categoria');
    Util.llenarSelect(select, CatalogoInsumos.categorias[etapa] || [], etapa ? 'Seleccione…' : 'Primero elija la etapa');
    select.disabled = !etapa;
  },

  actualizarTotal() {
    const cantidad = document.getElementById('ins-cantidad').value;
    const costo = document.getElementById('ins-costo').value;
    const salida = document.getElementById('ins-total');
    salida.textContent = cantidad !== '' && costo !== ''
      ? Util.formatoMoneda(Util.redondear(Number(cantidad) * Number(costo)))
      : '—';
  },

  render() {
    const proyectos = Util.opcionesProyectos();
    Util.llenarSelect(document.getElementById('ins-proyecto'), proyectos, proyectos.length ? 'Seleccione…' : 'Registre primero un proyecto');
    Util.llenarSelect(document.getElementById('ins-filtro-proyecto'), proyectos, 'Todos');
    const proveedores = [...new Set(Almacen.listar('insumos').map(i => i.proveedor).filter(Boolean))].sort();
    document.getElementById('lista-proveedores').innerHTML = proveedores.map(p => `<option value="${Util.esc(p)}">`).join('');
    this.actualizarTotal();
    this.renderTabla();
  },

  filtrar() {
    const texto = document.getElementById('ins-buscar').value.trim().toLowerCase();
    const proyecto = document.getElementById('ins-filtro-proyecto').value;
    const etapa = document.getElementById('ins-filtro-etapa').value;
    const estado = document.getElementById('ins-filtro-estado').value;

    return Almacen.listar('insumos').filter(i => {
      if (proyecto && i.proyectoId !== proyecto) return false;
      if (etapa && i.etapa !== etapa) return false;
      if (estado && i.estado !== estado) return false;
      if (texto) {
        const contenido = [i.descripcion, i.categoria, i.proveedor, i.unidad, Util.nombreProyecto(i.proyectoId)].join(' ').toLowerCase();
        if (!contenido.includes(texto)) return false;
      }
      return true;
    });
  },

  renderTabla() {
    const orden = { 'Exploración': 0, 'Explotación': 1 };
    const lista = this.filtrar().sort((a, b) =>
      Util.nombreProyecto(a.proyectoId).localeCompare(Util.nombreProyecto(b.proyectoId), 'es') ||
      orden[a.etapa] - orden[b.etapa] ||
      a.categoria.localeCompare(b.categoria, 'es'));
    const total = Almacen.listar('insumos').length;
    document.getElementById('ins-contador').textContent = `(${lista.length} de ${total})`;

    const cuerpo = document.getElementById('tabla-insumos');
    const sumaFiltrada = lista.reduce((suma, i) => suma + this.costoTotal(i), 0);
    document.getElementById('ins-total-filtrado').textContent = Util.formatoMoneda(sumaFiltrada);

    if (!lista.length) {
      cuerpo.innerHTML = `<tr><td colspan="11" class="vacio">${total ? 'Ningún insumo coincide con los filtros.' : 'Aún no hay insumos registrados.'}</td></tr>`;
      return;
    }
    cuerpo.innerHTML = lista.map(i => `
      <tr>
        <td>${Util.esc(Util.nombreProyecto(i.proyectoId))}</td>
        <td>${Util.badge(i.etapa, 'etapa')}</td>
        <td>${Util.esc(i.categoria)}</td>
        <td>${Util.esc(i.descripcion)}</td>
        <td class="num">${Util.formatoNumero(i.cantidad)}</td>
        <td>${Util.esc(i.unidad)}</td>
        <td class="num">${Util.formatoMoneda(i.costoUnitario)}</td>
        <td class="num"><strong>${Util.formatoMoneda(this.costoTotal(i))}</strong></td>
        <td>${Util.esc(i.proveedor || '—')}</td>
        <td>${Util.badge(i.estado, 'insumo')}</td>
        <td class="acciones-col">${Util.botonesAccion(i.id, i.descripcion)}</td>
      </tr>`).join('');
  },

  leerFormulario() {
    const valor = id => document.getElementById(id).value.trim();
    return {
      proyectoId: valor('ins-proyecto'),
      etapa: valor('ins-etapa'),
      categoria: valor('ins-categoria'),
      descripcion: valor('ins-descripcion'),
      cantidad: valor('ins-cantidad') === '' ? '' : Number(valor('ins-cantidad')),
      unidad: valor('ins-unidad'),
      costoUnitario: valor('ins-costo') === '' ? '' : Number(valor('ins-costo')),
      proveedor: valor('ins-proveedor'),
      estado: valor('ins-estado')
    };
  },

  validar(datos) {
    Util.limpiarErrores(this.formulario);
    let valido = Util.validarRequeridos(this.formulario);
    if (datos.cantidad !== '' && !(datos.cantidad > 0)) {
      Util.marcarError(document.getElementById('ins-cantidad'), 'La cantidad debe ser mayor que 0.');
      valido = false;
    }
    if (datos.costoUnitario !== '' && !(datos.costoUnitario >= 0)) {
      Util.marcarError(document.getElementById('ins-costo'), 'El costo unitario no puede ser negativo.');
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
    const id = document.getElementById('ins-id').value;
    if (id) {
      Almacen.actualizar('insumos', id, datos);
      Util.toast('Insumo actualizado.');
    } else {
      Almacen.agregar('insumos', datos);
      Util.toast(`Insumo registrado: ${datos.descripcion} (${Util.formatoMoneda(this.costoTotal(datos))}).`);
    }
    this.cancelarEdicion();
    this.render();
  },

  editar(id) {
    const i = Almacen.buscar('insumos', id);
    if (!i) return;
    this.cancelarEdicion();
    const asignar = (campo, valor) => { document.getElementById(campo).value = valor ?? ''; };
    asignar('ins-id', i.id);
    asignar('ins-proyecto', i.proyectoId);
    asignar('ins-etapa', i.etapa);
    this.actualizarCategorias();
    asignar('ins-categoria', i.categoria);
    asignar('ins-descripcion', i.descripcion);
    asignar('ins-cantidad', i.cantidad);
    asignar('ins-unidad', i.unidad);
    asignar('ins-costo', i.costoUnitario);
    asignar('ins-proveedor', i.proveedor);
    asignar('ins-estado', i.estado);
    this.actualizarTotal();

    document.getElementById('titulo-form-insumo').textContent = `Editando insumo: ${i.descripcion}`;
    document.getElementById('btn-ins-guardar').textContent = 'Guardar cambios';
    document.getElementById('btn-ins-cancelar').textContent = 'Cancelar edición';
    this.formulario.classList.add('editando');
    this.formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('ins-descripcion').focus({ preventScroll: true });
  },

  cancelarEdicion() {
    this.formulario.reset();
    document.getElementById('ins-id').value = '';
    Util.limpiarErrores(this.formulario);
    this.actualizarCategorias();
    this.actualizarTotal();
    document.getElementById('titulo-form-insumo').textContent = 'Registrar requerimiento o insumo';
    document.getElementById('btn-ins-guardar').textContent = 'Guardar insumo';
    document.getElementById('btn-ins-cancelar').textContent = 'Limpiar';
    this.formulario.classList.remove('editando');
  },

  async eliminar(id) {
    const i = Almacen.buscar('insumos', id);
    if (!i) return;
    const confirmado = await Util.confirmar(`¿Eliminar el insumo «${i.descripcion}» (${Util.formatoMoneda(this.costoTotal(i))})? Esta acción no se puede deshacer.`);
    if (!confirmado) return;
    Almacen.eliminar('insumos', id);
    if (document.getElementById('ins-id').value === id) this.cancelarEdicion();
    Util.toast('Insumo eliminado.', 'info');
    this.render();
  }
};
