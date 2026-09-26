/* ==========================================================================
   MineraGest - storage.js
   Lectura y escritura de datos en localStorage, respaldo/importación JSON
   y datos de ejemplo (seed) para la primera ejecución.
   ========================================================================== */
'use strict';

const Almacen = {
  CLAVE: 'mineragest_datos_v1',
  datos: null,

  /** Carga los datos guardados o, si no existen, genera los de ejemplo. */
  cargar() {
    try {
      const texto = localStorage.getItem(this.CLAVE);
      if (texto) {
        const datosGuardados = JSON.parse(texto);
        if (this.esValido(datosGuardados)) {
          this.datos = this.normalizar(datosGuardados);
          return;
        }
      }
    } catch (error) {
      console.warn('No se pudieron leer los datos guardados:', error);
    }
    this.datos = DatosEjemplo.generar();
    this.guardar();
  },

  guardar() {
    try {
      localStorage.setItem(this.CLAVE, JSON.stringify(this.datos));
    } catch (error) {
      console.error(error);
      Util.toast('No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).', 'error');
    }
  },

  esValido(d) {
    return Boolean(d) && Array.isArray(d.proyectos) && Array.isArray(d.insumos) && Array.isArray(d.tareas);
  },

  normalizar(d) {
    return {
      version: 1,
      config: Object.assign({ moneda: 'USD' }, d.config),
      proyectos: d.proyectos,
      insumos: d.insumos,
      tareas: d.tareas
    };
  },

  /* ---------- Operaciones genéricas por colección ---------- */

  listar(coleccion) {
    return this.datos[coleccion];
  },

  buscar(coleccion, id) {
    return this.datos[coleccion].find(registro => registro.id === id) || null;
  },

  agregar(coleccion, registro) {
    const ahora = new Date().toISOString();
    const nuevo = Object.assign({}, registro, {
      id: Util.generarId(coleccion.slice(0, 3)),
      creado: ahora,
      actualizado: ahora
    });
    this.datos[coleccion].push(nuevo);
    this.guardar();
    return nuevo;
  },

  actualizar(coleccion, id, cambios) {
    const registro = this.buscar(coleccion, id);
    if (!registro) return null;
    Object.assign(registro, cambios, { actualizado: new Date().toISOString() });
    this.guardar();
    return registro;
  },

  eliminar(coleccion, id) {
    this.datos[coleccion] = this.datos[coleccion].filter(registro => registro.id !== id);
    this.guardar();
  },

  /** Elimina un proyecto junto con sus insumos y tareas asociados. */
  eliminarProyecto(id) {
    this.datos.proyectos = this.datos.proyectos.filter(p => p.id !== id);
    this.datos.insumos = this.datos.insumos.filter(i => i.proyectoId !== id);
    this.datos.tareas = this.datos.tareas.filter(t => t.proyectoId !== id);
    this.guardar();
  },

  configurar(clave, valor) {
    this.datos.config[clave] = valor;
    this.guardar();
  },

  /* ---------- Respaldo e importación ---------- */

  exportarJSON() {
    const contenido = JSON.stringify(Object.assign({ exportado: new Date().toISOString() }, this.datos), null, 2);
    const blob = new Blob([contenido], { type: 'application/json' });
    Util.descargarBlob(blob, `respaldo_mineragest_${Util.hoyISO()}.json`);
  },

  /** Reemplaza todos los datos con el contenido de un respaldo JSON. Lanza error si no es válido. */
  importarJSON(texto) {
    let datosImportados;
    try {
      datosImportados = JSON.parse(texto);
    } catch (error) {
      throw new Error('El archivo no es un JSON válido.');
    }
    if (!this.esValido(datosImportados)) {
      throw new Error('El archivo no tiene la estructura de un respaldo de MineraGest (proyectos, insumos y tareas).');
    }
    this.datos = this.normalizar(datosImportados);
    this.guardar();
  },

  restablecer() {
    this.datos = DatosEjemplo.generar();
    this.guardar();
  }
};

/* ==========================================================================
   Datos de ejemplo: cuatro proyectos ficticios con insumos típicos por
   mineral y tipo de yacimiento, y tareas con fechas relativas a hoy.
   ========================================================================== */
const DatosEjemplo = {
  generar() {
    const dias = n => Util.sumarDias(n);
    const creadoHace = n => new Date(Date.now() - n * 86400000).toISOString();

    const proyectos = [
      {
        id: 'pro-ej1', nombre: 'Unidad Minera Santa Rosa', region: 'La Libertad', provincia: 'Pataz', distrito: 'Parcoy',
        mineralPrincipal: 'Oro', mineralesSecundarios: ['Plata'], tipoYacimiento: 'Veta', metodo: 'Subterránea',
        etapa: 'Explotación', ley: 8.5, unidadLey: 'g/t', reservas: 450000, fechaInicio: dias(-900),
        observaciones: 'Vetas mesotermales de cuarzo-pirita. Método de minado corte y relleno ascendente.'
      },
      {
        id: 'pro-ej2', nombre: 'Proyecto Cobre Los Andes', region: 'Apurímac', provincia: 'Cotabambas', distrito: 'Tambobamba',
        mineralPrincipal: 'Cobre', mineralesSecundarios: ['Molibdeno', 'Oro', 'Plata'], tipoYacimiento: 'Pórfido', metodo: 'Tajo abierto',
        etapa: 'Explotación', ley: 0.65, unidadLey: '%', reservas: 850000000, fechaInicio: dias(-600),
        observaciones: 'Pórfido de Cu-Mo. Planta concentradora por flotación.'
      },
      {
        id: 'pro-ej3', nombre: 'Proyecto Polimetálico Cerro Azul', region: 'Pasco', provincia: 'Pasco', distrito: 'Yanacancha',
        mineralPrincipal: 'Zinc', mineralesSecundarios: ['Plomo', 'Plata'], tipoYacimiento: 'Skarn', metodo: 'Subterránea',
        etapa: 'Exploración', ley: 6.2, unidadLey: '%', reservas: 12000000, fechaInicio: dias(-200),
        observaciones: 'Campaña de perforación de segunda fase en curso.'
      },
      {
        id: 'pro-ej4', nombre: 'Unidad Minera San Cristóbal II', region: 'Junín', provincia: 'Yauli', distrito: 'Yauli',
        mineralPrincipal: 'Plata', mineralesSecundarios: ['Plomo', 'Zinc'], tipoYacimiento: 'Veta', metodo: 'Subterránea',
        etapa: 'Desarrollo', ley: 12.4, unidadLey: 'oz/t', reservas: 1800000, fechaInicio: dias(-120),
        observaciones: 'Preparación de rampas y accesos al nivel 4200.'
      }
    ];

    // [proyectoId, etapa, categoría, descripción, cantidad, unidad, costoUnitario, proveedor, estado, díasDesdeRegistro]
    const filasInsumos = [
      // Oro en veta subterránea
      ['pro-ej1', 'Exploración', 'Geología y mapeo', 'Mapeo geológico-estructural de vetas', 1, 'global', 18000, 'GeoConsult Andina', 'Consumido', 880],
      ['pro-ej1', 'Exploración', 'Perforación diamantina/RC', 'Perforación diamantina HQ/NQ desde interior mina', 3500, 'm', 180, 'Perforaciones del Sur', 'Consumido', 850],
      ['pro-ej1', 'Exploración', 'Laboratorio (ensayos)', 'Ensayos de oro al fuego (fire assay)', 1200, 'muestra', 25, 'Laboratorio Minero Certificado', 'Consumido', 820],
      ['pro-ej1', 'Exploración', 'Permisos ambientales (DIA, EIA-sd)', 'Declaración de Impacto Ambiental (DIA) de exploración', 1, 'global', 25000, 'EcoAmbiental SAC', 'Consumido', 900],
      ['pro-ej1', 'Explotación', 'Explosivos y accesorios', 'Emulsión encartuchada 1 1/8" x 12"', 8000, 'kg', 2.8, 'Explosivos Industriales', 'En almacén', 30],
      ['pro-ej1', 'Explotación', 'Explosivos y accesorios', 'Fulminantes no eléctricos', 6000, 'und', 1.5, 'Explosivos Industriales', 'En almacén', 30],
      ['pro-ej1', 'Explotación', 'Reactivos (cianuro, cal, xantatos, etc.)', 'Cianuro de sodio para lixiviación', 40, 't', 3200, 'Químicos Mineros', 'Solicitado', 12],
      ['pro-ej1', 'Explotación', 'Reactivos (cianuro, cal, xantatos, etc.)', 'Cal viva para control de pH', 120, 't', 180, 'Calera del Norte', 'Requerido', 5],
      ['pro-ej1', 'Explotación', 'Maquinaria y equipos', 'Scoop LHD 2.2 yd³ (alquiler mensual)', 6, 'mes', 22000, 'Equipos Mineros Rent', 'Consumido', 60],
      ['pro-ej1', 'Explotación', 'Combustible', 'Diésel B5', 30000, 'gal', 4.2, 'Combustibles Andinos', 'En almacén', 20],
      ['pro-ej1', 'Explotación', 'EPP (equipos de protección personal)', 'Kit EPP (casco, lámpara, respirador, botas, arnés)', 150, 'und', 320, 'Seguridad Total', 'En almacén', 40],
      ['pro-ej1', 'Explotación', 'Repuestos', 'Barrenos integrales de 8 pies', 200, 'und', 95, 'Aceros de Perforación', 'Requerido', 3],
      // Cobre en pórfido a tajo abierto
      ['pro-ej2', 'Exploración', 'Geofísica', 'Polarización inducida (IP) y magnetometría', 1, 'global', 120000, 'Geofísica Integral', 'Consumido', 590],
      ['pro-ej2', 'Exploración', 'Geoquímica (muestreo)', 'Muestreo de suelos y esquirlas de roca', 2500, 'muestra', 18, 'GeoConsult Andina', 'Consumido', 580],
      ['pro-ej2', 'Exploración', 'Perforación diamantina/RC', 'Perforación de circulación reversa (RC)', 8000, 'm', 95, 'Perforaciones del Sur', 'Consumido', 560],
      ['pro-ej2', 'Exploración', 'Topografía', 'Levantamiento topográfico con dron LiDAR', 1, 'global', 35000, 'TopoDron', 'Consumido', 570],
      ['pro-ej2', 'Exploración', 'Permisos sociales (consulta previa)', 'Talleres informativos y proceso de consulta previa', 1, 'global', 45000, 'Relaciones Comunitarias', 'Consumido', 595],
      ['pro-ej2', 'Explotación', 'Explosivos y accesorios', 'ANFO a granel', 500, 't', 650, 'Explosivos Industriales', 'En almacén', 25],
      ['pro-ej2', 'Explotación', 'Maquinaria y equipos', 'Camión minero 240 t (alquiler mensual)', 12, 'mes', 185000, 'Equipos Mineros Rent', 'Solicitado', 15],
      ['pro-ej2', 'Explotación', 'Reactivos (cianuro, cal, xantatos, etc.)', 'Xantato isopropílico de sodio (Z-11)', 60, 't', 2100, 'Químicos Mineros', 'Requerido', 8],
      ['pro-ej2', 'Explotación', 'Reactivos (cianuro, cal, xantatos, etc.)', 'Espumante MIBC', 25, 't', 2600, 'Químicos Mineros', 'Requerido', 8],
      ['pro-ej2', 'Explotación', 'Energía eléctrica', 'Energía para planta concentradora', 4500000, 'kWh', 0.07, 'Red Eléctrica Nacional', 'Consumido', 30],
      ['pro-ej2', 'Explotación', 'Agua', 'Agua industrial para proceso', 200000, 'm³', 0.5, 'Junta de Usuarios', 'Consumido', 30],
      ['pro-ej2', 'Explotación', 'Transporte', 'Transporte de concentrado a puerto', 9000, 't', 38, 'Transportes Andinos', 'Solicitado', 10],
      ['pro-ej2', 'Explotación', 'Permisos (EIA, plan de minado, plan de cierre)', 'Actualización del plan de cierre de minas', 1, 'global', 150000, 'EcoAmbiental SAC', 'Requerido', 2],
      // Zinc-plomo en skarn (exploración)
      ['pro-ej3', 'Exploración', 'Geología y mapeo', 'Mapeo geológico a escala 1:2000', 1, 'global', 22000, 'GeoConsult Andina', 'Consumido', 190],
      ['pro-ej3', 'Exploración', 'Perforación diamantina/RC', 'Perforación diamantina HQ', 5000, 'm', 170, 'Perforaciones del Sur', 'Solicitado', 45],
      ['pro-ej3', 'Exploración', 'Laboratorio (ensayos)', 'Análisis multielemento ICP', 1800, 'muestra', 30, 'Laboratorio Minero Certificado', 'Requerido', 20],
      ['pro-ej3', 'Exploración', 'Permisos ambientales (DIA, EIA-sd)', 'Estudio de Impacto Ambiental semidetallado (EIA-sd)', 1, 'global', 60000, 'EcoAmbiental SAC', 'Solicitado', 150],
      // Plata en veta subterránea (desarrollo)
      ['pro-ej4', 'Explotación', 'Explosivos y accesorios', 'Dinamita semigelatinosa 65%', 3000, 'kg', 3.1, 'Explosivos Industriales', 'Requerido', 10],
      ['pro-ej4', 'Explotación', 'Mano de obra', 'Cuadrilla de perforistas y ayudantes', 4, 'mes', 38000, 'Contratista Minero Junín', 'Solicitado', 35],
      ['pro-ej4', 'Explotación', 'Maquinaria y equipos', 'Jumbo electrohidráulico de 1 brazo (alquiler)', 4, 'mes', 30000, 'Equipos Mineros Rent', 'Requerido', 7]
    ];

    const insumos = filasInsumos.map((f, i) => ({
      id: 'ins-ej' + (i + 1), proyectoId: f[0], etapa: f[1], categoria: f[2], descripcion: f[3],
      cantidad: f[4], unidad: f[5], costoUnitario: f[6], proveedor: f[7], estado: f[8],
      creado: creadoHace(f[9]), actualizado: creadoHace(f[9])
    }));

    // [título, descripción, proyectoId, etapa, área, responsable, prioridad, inicio, límite, estado, díasDesdeRegistro]
    const filasTareas = [
      ['Logueo geológico de sondajes DDH-45 a DDH-52', 'Describir litología, alteración y mineralización de los testigos.', 'pro-ej3', 'Exploración', 'Geología', 'Ana Quispe', 'Alta', dias(-10), dias(5), 'En progreso', 10],
      ['Envío de muestras al laboratorio', 'Despachar 320 muestras con cadena de custodia.', 'pro-ej3', 'Exploración', 'Logística', 'Luis Mamani', 'Media', dias(-6), dias(-1), 'Pendiente', 6],
      ['Diseño de malla de perforación Nv. 2850', 'Malla para tajeo 450 con burden y espaciamiento ajustados.', 'pro-ej1', 'Explotación', 'Perforación', 'Carlos Huamán', 'Alta', dias(-4), dias(2), 'En progreso', 4],
      ['Voladura controlada en frente de avance', 'Aplicar precorte para reducir sobrerotura.', 'pro-ej1', 'Explotación', 'Voladura', 'Carlos Huamán', 'Alta', dias(-3), dias(-1), 'Pendiente', 3],
      ['Inspección de sostenimiento en labores', 'Verificar pernos y malla en rampa principal.', 'pro-ej1', 'Explotación', 'Seguridad', 'Rosa Paredes', 'Media', dias(-15), dias(-8), 'Completada', 15],
      ['Monitoreo de calidad de agua', 'Muestreo trimestral en puntos de control aguas abajo.', 'pro-ej2', 'Explotación', 'Medio ambiente', 'Jorge Salazar', 'Media', dias(-20), dias(-5), 'Completada', 20],
      ['Optimización de ciclo de carguío y acarreo', 'Reducir tiempos de espera de camiones en pala 3.', 'pro-ej2', 'Explotación', 'Carguío y acarreo', 'María Torres', 'Media', dias(-2), dias(12), 'Pendiente', 2],
      ['Ajuste de dosificación de reactivos en flotación', 'Pruebas con xantato Z-11 y espumante MIBC.', 'pro-ej2', 'Explotación', 'Planta', 'Pedro Rojas', 'Alta', dias(-7), dias(3), 'En progreso', 7],
      ['Recepción de explosivos en polvorín', 'Verificar guías y registrar ingreso en el libro de control.', 'pro-ej4', 'Explotación', 'Logística', 'Luis Mamani', 'Baja', dias(1), dias(4), 'Pendiente', 1],
      ['Capacitación en IPERC y trabajos de alto riesgo', 'Charla para nuevo personal contratista.', 'pro-ej4', 'Explotación', 'Seguridad', 'Rosa Paredes', 'Media', dias(-12), dias(-10), 'Completada', 12]
    ];

    const tareas = filasTareas.map((f, i) => ({
      id: 'tar-ej' + (i + 1), titulo: f[0], descripcion: f[1], proyectoId: f[2], etapa: f[3], area: f[4],
      responsable: f[5], prioridad: f[6], fechaInicio: f[7], fechaLimite: f[8], estado: f[9],
      creado: creadoHace(f[10]), actualizado: creadoHace(f[10])
    }));

    const ahora = new Date().toISOString();
    proyectos.forEach(p => { p.creado = ahora; p.actualizado = ahora; });

    return { version: 1, config: { moneda: 'USD' }, proyectos, insumos, tareas };
  }
};
