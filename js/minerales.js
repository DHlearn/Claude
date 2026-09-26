/* ==========================================================================
   MineraGest - minerales.js
   Módulo de proyectos / yacimientos y del mineral que explota cada uno.
   ========================================================================== */
'use strict';

const CatalogoMinero = {
  minerales: ['Oro', 'Plata', 'Cobre', 'Zinc', 'Plomo', 'Hierro', 'Molibdeno', 'Estaño', 'Litio', 'Carbón', 'Otro'],
  tiposYacimiento: ['Veta', 'Pórfido', 'Aluvial', 'Diseminado', 'Skarn', 'Otro'],
  metodos: ['Tajo abierto', 'Subterránea', 'Aluvial'],
  etapasProyecto: ['Exploración', 'Desarrollo', 'Explotación', 'Cierre'],
  unidadesLey: ['g/t', '%', 'oz/t']
};

const Proyectos = {
  formulario: null,

  init() {
    this.formulario = document.getElementById('form-proyecto');
    const c = CatalogoMinero;

    Util.llenarSelect(document.getElementById('pro-mineral'), c.minerales, 'Seleccione…');
    Util.llenarSelect(document.getElementById('pro-yacimiento'), c.tiposYacimiento, 'Seleccione…');
    Util.llenarSelect(document.getElementById('pro-metodo'), c.metodos, 'Seleccione…');
    Util.llenarSelect(document.getElementById('pro-etapa'), c.etapasProyecto, 'Seleccione…');
    Util.llenarSelect(document.getElementById('pro-unidad-ley'), c.unidadesLey);
    Util.llenarSelect(document.getElementById('pro-filtro-etapa'), c.etapasProyecto, 'Todas');

    // Minerales secundarios como casillas (más cómodo que un select múltiple)
    document.getElementById('pro-secundarios').innerHTML = c.minerales
      .filter(m => m !== 'Otro')
      .map(m => `<label class="check"><input type="checkbox" value="${Util.esc(m)}"> ${Util.esc(m)}</label>`)
      .join('');

    document.getElementById('pro-mineral').addEventListener('change', () => this.actualizarMineralOtro());
    this.formulario.addEventListener('submit', evento => { evento.preventDefault(); this.guardar(); });
    document.getElementById('btn-pro-cancelar').addEventListener('click', () => this.cancelarEdicion());

    ['pro-buscar', 'pro-filtro-mineral', 'pro-filtro-etapa'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.renderTabla());
    });

    document.getElementById('tabla-proyectos').addEventListener('click', evento => {
      const boton = evento.target.closest('button[data-accion]');
      if (!boton) return;
      if (boton.dataset.accion === 'editar') this.editar(boton.dataset.id);
      if (boton.dataset.accion === 'eliminar') this.eliminar(boton.dataset.id);
    });
  },

  actualizarMineralOtro() {
    const esOtro = document.getElementById('pro-mineral').value === 'Otro';
    const campo = document.getElementById('campo-mineral-otro');
    campo.hidden = !esOtro;
    const input = document.getElementById('pro-mineral-otro');
    if (esOtro) input.setAttribute('data-requerido', ''); else input.removeAttribute('data-requerido');
  },

  render() {
    // Filtro de minerales: catálogo + minerales personalizados ya registrados
    const usados = Almacen.listar('proyectos').map(p => p.mineralPrincipal);
    const opciones = [...new Set([...CatalogoMinero.minerales.filter(m => m !== 'Otro'), ...usados])];
    Util.llenarSelect(document.getElementById('pro-filtro-mineral'), opciones, 'Todos');
    this.renderTabla();
  },

  filtrar() {
    const texto = document.getElementById('pro-buscar').value.trim().toLowerCase();
    const mineral = document.getElementById('pro-filtro-mineral').value;
    const etapa = document.getElementById('pro-filtro-etapa').value;

    return Almacen.listar('proyectos').filter(p => {
      if (mineral && p.mineralPrincipal !== mineral && !(p.mineralesSecundarios || []).includes(mineral)) return false;
      if (etapa && p.etapa !== etapa) return false;
      if (texto) {
        const contenido = [p.nombre, p.region, p.provincia, p.distrito, p.mineralPrincipal,
          ...(p.mineralesSecundarios || []), p.tipoYacimiento, p.metodo, p.observaciones].join(' ').toLowerCase();
        if (!contenido.includes(texto)) return false;
      }
      return true;
    });
  },

  renderTabla() {
    const lista = this.filtrar().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const total = Almacen.listar('proyectos').length;
    document.getElementById('pro-contador').textContent = `(${lista.length} de ${total})`;

    const cuerpo = document.getElementById('tabla-proyectos');
    if (!lista.length) {
      cuerpo.innerHTML = `<tr><td colspan="10" class="vacio">${total ? 'Ningún proyecto coincide con los filtros.' : 'Aún no hay proyectos. Registra el primero con el formulario.'}</td></tr>`;
      return;
    }
    cuerpo.innerHTML = lista.map(p => `
      <tr>
        <td><strong>${Util.esc(p.nombre)}</strong>${p.observaciones ? `<br><small class="texto-tenue">${Util.esc(p.observaciones)}</small>` : ''}</td>
        <td>${Util.esc([p.distrito, p.provincia, p.region].filter(Boolean).join(', '))}</td>
        <td><span class="chip-mineral">${Util.esc(p.mineralPrincipal)}</span></td>
        <td>${Util.esc((p.mineralesSecundarios || []).join(', ') || '—')}</td>
        <td>${Util.esc(p.tipoYacimiento)}<br><small class="texto-tenue">${Util.esc(p.metodo)}</small></td>
        <td>${Util.badge(p.etapa, 'etapa')}</td>
        <td class="num">${p.ley !== '' && p.ley != null ? `${Util.formatoNumero(p.ley, 3)} ${Util.esc(p.unidadLey)}` : '—'}</td>
        <td class="num">${p.reservas !== '' && p.reservas != null ? Util.formatoNumero(p.reservas, 0) : '—'}</td>
        <td>${Util.formatoFecha(p.fechaInicio)}</td>
        <td class="acciones-col">${Util.botonesAccion(p.id, p.nombre)}</td>
      </tr>`).join('');
  },

  leerFormulario() {
    const valor = id => document.getElementById(id).value.trim();
    const numero = id => (valor(id) === '' ? '' : Number(valor(id)));
    const mineral = valor('pro-mineral') === 'Otro' ? valor('pro-mineral-otro') : valor('pro-mineral');
    return {
      nombre: valor('pro-nombre'),
      region: valor('pro-region'),
      provincia: valor('pro-provincia'),
      distrito: valor('pro-distrito'),
      mineralPrincipal: mineral,
      mineralesSecundarios: [...document.querySelectorAll('#pro-secundarios input:checked')]
        .map(c => c.value)
        .filter(m => m !== mineral),
      tipoYacimiento: valor('pro-yacimiento'),
      metodo: valor('pro-metodo'),
      etapa: valor('pro-etapa'),
      ley: numero('pro-ley'),
      unidadLey: valor('pro-unidad-ley'),
      reservas: numero('pro-reservas'),
      fechaInicio: valor('pro-fecha'),
      observaciones: valor('pro-observaciones')
    };
  },

  validar(datos) {
    Util.limpiarErrores(this.formulario);
    let valido = Util.validarRequeridos(this.formulario);
    if (datos.ley !== '' && (isNaN(datos.ley) || datos.ley < 0)) {
      Util.marcarError(document.getElementById('pro-ley'), 'La ley debe ser un número mayor o igual a 0.');
      valido = false;
    }
    if (datos.reservas !== '' && (isNaN(datos.reservas) || datos.reservas < 0)) {
      Util.marcarError(document.getElementById('pro-reservas'), 'Las reservas deben ser un número mayor o igual a 0.');
      valido = false;
    }
    const duplicado = Almacen.listar('proyectos').some(p =>
      p.nombre.toLowerCase() === datos.nombre.toLowerCase() && p.id !== document.getElementById('pro-id').value);
    if (datos.nombre && duplicado) {
      Util.marcarError(document.getElementById('pro-nombre'), 'Ya existe un proyecto con este nombre.');
      valido = false;
    }
    if (!valido) Util.enfocarPrimerError(this.formulario);
    return valido;
  },

  guardar() {
    const datos = this.leerFormulario();
    if (!this.validar(datos)) {
      Util.toast('Revisa los campos marcados en rojo.', 'error');
      return;
    }
    const id = document.getElementById('pro-id').value;
    if (id) {
      Almacen.actualizar('proyectos', id, datos);
      Util.toast(`Proyecto «${datos.nombre}» actualizado.`);
    } else {
      Almacen.agregar('proyectos', datos);
      Util.toast(`Proyecto «${datos.nombre}» registrado.`);
    }
    this.cancelarEdicion();
    this.render();
  },

  editar(id) {
    const p = Almacen.buscar('proyectos', id);
    if (!p) return;
    this.cancelarEdicion();
    const asignar = (campo, valor) => { document.getElementById(campo).value = valor ?? ''; };
    const enCatalogo = CatalogoMinero.minerales.includes(p.mineralPrincipal);

    asignar('pro-id', p.id);
    asignar('pro-nombre', p.nombre);
    asignar('pro-region', p.region);
    asignar('pro-provincia', p.provincia);
    asignar('pro-distrito', p.distrito);
    asignar('pro-mineral', enCatalogo ? p.mineralPrincipal : 'Otro');
    asignar('pro-mineral-otro', enCatalogo ? '' : p.mineralPrincipal);
    this.actualizarMineralOtro();
    document.querySelectorAll('#pro-secundarios input').forEach(c => {
      c.checked = (p.mineralesSecundarios || []).includes(c.value);
    });
    asignar('pro-yacimiento', p.tipoYacimiento);
    asignar('pro-metodo', p.metodo);
    asignar('pro-etapa', p.etapa);
    asignar('pro-ley', p.ley);
    asignar('pro-unidad-ley', p.unidadLey || 'g/t');
    asignar('pro-reservas', p.reservas);
    asignar('pro-fecha', p.fechaInicio);
    asignar('pro-observaciones', p.observaciones);

    document.getElementById('titulo-form-proyecto').textContent = `Editando: ${p.nombre}`;
    document.getElementById('btn-pro-guardar').textContent = 'Guardar cambios';
    document.getElementById('btn-pro-cancelar').textContent = 'Cancelar edición';
    this.formulario.classList.add('editando');
    this.formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('pro-nombre').focus({ preventScroll: true });
  },

  cancelarEdicion() {
    this.formulario.reset();
    document.getElementById('pro-id').value = '';
    Util.limpiarErrores(this.formulario);
    this.actualizarMineralOtro();
    document.getElementById('titulo-form-proyecto').textContent = 'Registrar proyecto o unidad minera';
    document.getElementById('btn-pro-guardar').textContent = 'Guardar proyecto';
    document.getElementById('btn-pro-cancelar').textContent = 'Limpiar';
    this.formulario.classList.remove('editando');
  },

  async eliminar(id) {
    const p = Almacen.buscar('proyectos', id);
    if (!p) return;
    const numInsumos = Almacen.listar('insumos').filter(i => i.proyectoId === id).length;
    const numTareas = Almacen.listar('tareas').filter(t => t.proyectoId === id).length;
    const extra = numInsumos || numTareas
      ? ` También se eliminarán ${numInsumos} insumo(s) y ${numTareas} tarea(s) asociados.`
      : '';
    const confirmado = await Util.confirmar(`¿Eliminar el proyecto «${p.nombre}»?${extra} Esta acción no se puede deshacer.`);
    if (!confirmado) return;
    Almacen.eliminarProyecto(id);
    if (document.getElementById('pro-id').value === id) this.cancelarEdicion();
    Util.toast(`Proyecto «${p.nombre}» eliminado.`, 'info');
    this.render();
  }
};
