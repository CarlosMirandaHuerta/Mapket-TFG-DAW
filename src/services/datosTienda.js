import { productosDemo } from '@/data/productosDemo'
import { seccionesDemo } from '@/data/tiendaDemo'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { cleanEmailInput, cleanTextInput } from '@/services/security'

export const CODIGO_TIENDA_PREDETERMINADA = 'tienda-demo'

const cantidadPorDefecto = {
  disponible: 24,
  pocas_unidades: 5,
  agotado: 0,
}

const obtenerProductosDemo = () => {
  return productosDemo.map((producto) => ({
    ...producto,
    cantidad: cantidadPorDefecto[producto.disponibilidad],
  }))
}

const obtenerRegistrosActividadDemo = () => {
  const now = Date.now()

  return [
    {
      id: 'demo-actividad-1',
      nombreProducto: 'Helado de vainilla',
      accion: 'empleado_actualiza_producto',
      creadoEn: new Date(now - 1000 * 60 * 12).toISOString(),
      datosAntes: {
        nombre: 'Helado de vainilla',
        codigoSeccion: 'congelados',
        pasillo: 'Pasillo 7',
        estanteria: 'Congelador izquierdo',
        cantidad: 0,
        disponibilidad: 'agotado',
      },
      datosDespues: {
        nombre: 'Helado de vainilla',
        codigoSeccion: 'congelados',
        pasillo: 'Pasillo 7',
        estanteria: 'Congelador izquierdo',
        cantidad: 3,
        disponibilidad: 'pocas_unidades',
      },
    },
    {
      id: 'demo-actividad-2',
      nombreProducto: 'Papel higiénico',
      accion: 'empleado_actualiza_producto',
      creadoEn: new Date(now - 1000 * 60 * 48).toISOString(),
      datosAntes: {
        nombre: 'Papel higiénico',
        codigoSeccion: 'limpieza',
        pasillo: 'Pasillo 8',
        estanteria: 'Estantería inferior',
        cantidad: 12,
        disponibilidad: 'disponible',
      },
      datosDespues: {
        nombre: 'Papel higiénico',
        codigoSeccion: 'limpieza',
        pasillo: 'Pasillo 8',
        estanteria: 'Cabecera de pasillo',
        cantidad: 5,
        disponibilidad: 'pocas_unidades',
      },
    },
  ]
}

const obtenerEmpleadosDemo = () => {
  const now = Date.now()

  return [
    {
      id: 'demo-empleado-admin',
      nombre: 'Responsable de tienda',
      rol: 'admin',
      creadoEn: new Date(now - 1000 * 60 * 60 * 24 * 18).toISOString(),
    },
    {
      id: 'demo-empleado-encargado',
      nombre: 'Encargado de sección',
      rol: 'encargado',
      creadoEn: new Date(now - 1000 * 60 * 60 * 24 * 9).toISOString(),
    },
    {
      id: 'demo-empleado-stocker',
      nombre: 'Reposición',
      rol: 'empleado',
      creadoEn: new Date(now - 1000 * 60 * 60 * 24 * 4).toISOString(),
    },
  ]
}

const obtenerDatosTiendaDemo = (mensajeError = '') => {
  return {
    tienda: {
      nombre: 'Tienda Demo',
      codigo: CODIGO_TIENDA_PREDETERMINADA,
      idBaseDatos: null,
    },
    secciones: seccionesDemo,
    productos: obtenerProductosDemo(),
    origen: 'demo',
    mensajeError,
  }
}

const obtenerEmpleadoActualDemo = () => {
  return {
    id: 'demo-empleado-admin',
    nombre: 'Responsable de tienda',
    rol: 'admin',
    tienda_id: null,
  }
}

const obtenerDetallesSeccion = (seccion, productos) => {
  const seccionDemo = seccionesDemo.find((item) => item.codigo === seccion.codigo)
  const productosSeccion = productos.filter((producto) => producto.codigoSeccion === seccion.codigo)
  const categorias = [...new Set(productosSeccion.map((producto) => producto.categoria))]
  const productosDestacados = productosSeccion.slice(0, 4).map((producto) => producto.nombre)

  return {
    categorias: categorias.length > 0 ? categorias : (seccionDemo?.categorias ?? []),
    productosDestacados: productosDestacados.length > 0 ? productosDestacados : (seccionDemo?.productosDestacados ?? []),
  }
}

const formatearSecciones = (secciones, productos) => {
  return secciones.map((seccion) => {
    const detalles = obtenerDetallesSeccion(seccion, productos)

    return {
      codigo: seccion.codigo,
      idBaseDatos: seccion.id,
      etiqueta: seccion.nombre,
      zona: seccion.zona_mapa,
      color: seccion.color,
      pasillo: seccion.etiqueta_pasillo,
      categorias: detalles.categorias,
      productosDestacados: detalles.productosDestacados,
    }
  })
}

const formatearProductos = (ubicaciones, elementosInventario) => {
  const inventarioPorProductoId = new Map(
    elementosInventario.map((item) => [item.producto_id, item]),
  )

  return ubicaciones
    .map((ubicacion) => {
      const producto = ubicacion.producto
      const inventario = inventarioPorProductoId.get(ubicacion.producto_id)

      return {
        id: producto.codigo,
        idBaseDatos: producto.id,
        nombre: producto.nombre,
        marca: producto.marca ?? 'Marca propia',
        categoria: producto.categoria?.nombre ?? 'Sin categoría',
        codigoSeccion: ubicacion.seccion?.codigo ?? '',
        idBaseDatosSeccion: ubicacion.seccion?.id ?? null,
        pasillo: ubicacion.pasillo,
        estanteria: ubicacion.estanteria,
        disponibilidad: inventario?.estado ?? 'disponible',
        cantidad: inventario?.cantidad ?? cantidadPorDefecto.disponible,
        aliasBusqueda: producto.alias_busqueda ?? [],
      }
    })
    .sort((primerProducto, segundoProducto) => primerProducto.nombre.localeCompare(segundoProducto.nombre, 'es'))
}

const formatearEmpleado = (empleado) => {
  return {
    id: empleado.id,
    nombre: empleado.nombre,
    rol: empleado.rol,
    creadoEn: empleado.creado_en ?? empleado.creadoEn ?? new Date().toISOString(),
  }
}

const formatearEmpleadoActual = (empleado) => {
  if (!empleado) {
    return null
  }

  return {
    id: empleado.id,
    nombre: empleado.nombre,
    rol: empleado.rol,
    tienda_id: empleado.tienda_id,
  }
}

const crearCodigo = (value) => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const obtenerListaAlias = (aliasBusqueda) => {
  if (Array.isArray(aliasBusqueda)) {
    return aliasBusqueda.map((alias) => cleanTextInput(alias, 80)).filter(Boolean)
  }

  return String(aliasBusqueda ?? '')
    .split(',')
    .map((alias) => cleanTextInput(alias, 80))
    .filter(Boolean)
}

const obtenerAliasProducto = (producto, seccion) => {
  return obtenerListaAlias([producto.nombre, producto.marca, seccion.etiqueta, seccion.codigo])
}

const formatearProductoCreado = (producto) => {
  return {
    id: producto.id,
    idBaseDatos: producto.idBaseDatos,
    nombre: producto.nombre,
    marca: producto.marca,
    categoria: producto.categoria,
    codigoSeccion: producto.codigoSeccion,
    idBaseDatosSeccion: producto.idBaseDatosSeccion,
    pasillo: producto.pasillo,
    estanteria: producto.estanteria,
    disponibilidad: producto.disponibilidad,
    cantidad: producto.cantidad,
    aliasBusqueda: producto.aliasBusqueda ?? [],
  }
}

const obtenerMensajeErrorFuncion = async (error) => {
  if (!error?.context || typeof error.context.json !== 'function') {
    return error?.message ?? 'No se ha podido completar la operación.'
  }

  try {
    const detalles = await error.context.json()
    return detalles.error ?? error.message
  } catch {
    return error.message
  }
}

export const completarAltaEmpleado = async () => {
  const { data, error } = await supabase.functions.invoke('completar-alta-empleado')

  if (error || data?.error) {
    return null
  }

  return formatearEmpleadoActual(data.empleado)
}

const obtenerTiendaSupabase = async (codigoTienda) => {
  const { data: tienda, error: errorTienda } = await supabase
    .from('tiendas')
    .select('id, nombre, codigo')
    .eq('codigo', codigoTienda)
    .maybeSingle()

  if (errorTienda) {
    throw errorTienda
  }

  return tienda
}

export const obtenerEmpleadoActual = async ({ completeOnboarding = true } = {}) => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      empleado: null,
      origen: 'demo',
    }
  }

  const { data: datosSesion, error: errorSesion } = await supabase.auth.getSession()

  if (errorSesion) {
    throw errorSesion
  }

  const userId = datosSesion.session?.user?.id

  if (!userId) {
    return {
      empleado: null,
      origen: 'supabase',
    }
  }

  const { data: empleado, error: errorEmpleado } = await supabase
    .from('empleados')
    .select('id, nombre, rol, tienda_id')
    .eq('usuario_auth_id', userId)
    .maybeSingle()

  if (errorEmpleado) {
    throw errorEmpleado
  }

  if (empleado) {
    return {
      empleado: formatearEmpleadoActual(empleado),
      origen: 'supabase',
    }
  }

  return {
    empleado: completeOnboarding ? await completarAltaEmpleado() : null,
    origen: 'supabase',
  }
}

export const obtenerEmpleadosTienda = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      empleadoActual: obtenerEmpleadoActualDemo(),
      empleados: obtenerEmpleadosDemo(),
      origen: 'demo',
      mensajeError: '',
    }
  }

  try {
    const { empleado: empleadoActual } = await obtenerEmpleadoActual()

    if (!empleadoActual) {
      throw new Error('Tu usuario no está registrado como empleado.')
    }

    const { data: empleados, error } = await supabase
      .from('empleados')
      .select('id, nombre, rol, creado_en')
      .order('creado_en', { ascending: false })

    if (error) {
      throw error
    }

    return {
      empleadoActual,
      empleados: (empleados ?? []).map(formatearEmpleado),
      origen: 'supabase',
      mensajeError: '',
    }
  } catch (error) {
    return {
      empleadoActual: obtenerEmpleadoActualDemo(),
      empleados: obtenerEmpleadosDemo(),
      origen: 'demo',
      mensajeError: error.message,
    }
  }
}

export const invitarEmpleado = async ({ email, nombre, redirectTo, rol }) => {
  const emailEmpleadoLimpio = cleanEmailInput(email)
  const nombreEmpleadoLimpio = cleanTextInput(nombre, 80)

  if (!isSupabaseConfigured || !supabase) {
    return {
      empleado: {
        id: `demo-empleado-${Date.now()}`,
        nombre: nombreEmpleadoLimpio,
        rol,
        creadoEn: new Date().toISOString(),
      },
      mensaje: 'Invitación simulada en modo demo.',
      origen: 'demo',
    }
  }

  const { data, error } = await supabase.functions.invoke('invitar-empleado', {
    body: {
      email: emailEmpleadoLimpio,
      nombre: nombreEmpleadoLimpio,
      redirectTo,
      rol,
    },
  })

  if (error) {
    throw new Error(await obtenerMensajeErrorFuncion(error))
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    empleado: data.empleado ? formatearEmpleado(data.empleado) : null,
    invitation: data.invitation ?? null,
    mensaje: data?.mensaje ?? 'Invitación enviada al empleado.',
    origen: 'supabase',
  }
}

export const eliminarEmpleado = async (empleadoId) => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      empleado: {
        id: empleadoId,
      },
      mensaje: 'Empleado eliminado en modo demo.',
      origen: 'demo',
    }
  }

  const { data, error } = await supabase.functions.invoke('eliminar-empleado', {
    body: {
      empleadoId,
    },
  })

  if (error) {
    throw new Error(await obtenerMensajeErrorFuncion(error))
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    empleado: data.empleado,
    mensaje: data?.mensaje ?? 'Empleado eliminado del equipo.',
    origen: 'supabase',
  }
}

const obtenerDatosTiendaSupabase = async (codigoTienda) => {
  const tienda = await obtenerTiendaSupabase(codigoTienda)

  if (!tienda) {
    throw new Error(`No se ha encontrado la tienda "${codigoTienda}" en Supabase.`)
  }

  const { data: secciones, error: errorSecciones } = await supabase
    .from('secciones')
    .select('id, nombre, codigo, color, zona_mapa, etiqueta_pasillo, orden')
    .eq('tienda_id', tienda.id)
    .order('orden')

  if (errorSecciones) {
    throw errorSecciones
  }

  const { data: ubicaciones, error: errorUbicaciones } = await supabase
    .from('ubicaciones_productos')
    .select(`
      producto_id,
      pasillo,
      estanteria,
      seccion:secciones!ubicaciones_productos_seccion_id_fkey(id, codigo, nombre),
      producto:productos(
        id,
        codigo,
        nombre,
        marca,
        alias_busqueda,
        categoria:categorias(nombre, codigo)
      )
    `)
    .eq('tienda_id', tienda.id)

  if (errorUbicaciones) {
    throw errorUbicaciones
  }

  const { data: elementosInventario, error: errorInventario } = await supabase
    .from('inventario')
    .select('producto_id, cantidad, estado')
    .eq('tienda_id', tienda.id)

  if (errorInventario) {
    throw errorInventario
  }

  const productos = formatearProductos(ubicaciones ?? [], elementosInventario ?? [])

  return {
    tienda: {
      nombre: tienda.nombre,
      codigo: tienda.codigo,
      idBaseDatos: tienda.id,
    },
    secciones: formatearSecciones(secciones ?? [], productos),
    productos,
    origen: 'supabase',
    mensajeError: '',
  }
}

const formatearRegistroActividad = (log) => {
  const datosAntes = log.datos_antes ?? {}
  const datosDespues = log.datos_despues ?? {}

  return {
    id: log.id,
    nombreProducto: datosDespues.nombre ?? datosAntes.nombre ?? 'Producto',
    accion: log.accion,
    creadoEn: log.creado_en,
    datosAntes,
    datosDespues,
  }
}

export const obtenerRegistrosActividad = async (codigoTienda = CODIGO_TIENDA_PREDETERMINADA) => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      registros: obtenerRegistrosActividadDemo(),
      origen: 'demo',
      mensajeError: '',
    }
  }

  try {
    const tienda = await obtenerTiendaSupabase(codigoTienda)

    if (!tienda) {
      return {
        registros: obtenerRegistrosActividadDemo(),
        origen: 'demo',
        mensajeError: `No se ha encontrado la tienda "${codigoTienda}" en Supabase.`,
      }
    }

    const { data: registros, error } = await supabase
      .from('registros_actividad')
      .select('id, accion, datos_antes, datos_despues, creado_en')
      .eq('tienda_id', tienda.id)
      .order('creado_en', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    return {
      registros: (registros ?? []).map(formatearRegistroActividad),
      origen: 'supabase',
      mensajeError: '',
    }
  } catch (error) {
    return {
      registros: obtenerRegistrosActividadDemo(),
      origen: 'demo',
      mensajeError: error.message,
    }
  }
}

const obtenerDatosRegistroProducto = (producto) => {
  return {
    id: producto.id,
    nombre: producto.nombre,
    codigoSeccion: producto.codigoSeccion,
    pasillo: producto.pasillo,
    estanteria: producto.estanteria,
    cantidad: producto.cantidad,
    disponibilidad: producto.disponibilidad,
  }
}

const obtenerCantidadEntera = (cantidad) => {
  const numericQuantity = Number(cantidad)

  if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
    return 0
  }

  return Math.trunc(numericQuantity)
}

export const guardarProductoTienda = async ({ tienda, secciones, producto, productoAnterior }) => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      origen: 'demo',
    }
  }

  if (!tienda.idBaseDatos || !producto.idBaseDatos) {
    throw new Error('No se ha cargado la tienda real de Supabase.')
  }

  const seccion = secciones.find((item) => item.codigo === producto.codigoSeccion)

  if (!seccion?.idBaseDatos) {
    throw new Error('No se ha encontrado la sección seleccionada.')
  }

  const cantidad = obtenerCantidadEntera(producto.cantidad)
  const productoLimpio = {
    ...producto,
    pasillo: cleanTextInput(producto.pasillo, 60),
    estanteria: cleanTextInput(producto.estanteria, 80),
  }
  const cambiosUbicacion = {
    seccion_id: seccion.idBaseDatos,
    pasillo: productoLimpio.pasillo,
    estanteria: productoLimpio.estanteria,
  }
  const cambiosInventario = {
    cantidad,
    estado: producto.disponibilidad,
  }

  const { data: ubicacionActualizada, error: errorUbicacion } = await supabase
    .from('ubicaciones_productos')
    .update(cambiosUbicacion)
    .eq('tienda_id', tienda.idBaseDatos)
    .eq('producto_id', producto.idBaseDatos)
    .select('id')
    .maybeSingle()

  if (errorUbicacion) {
    throw errorUbicacion
  }

  if (!ubicacionActualizada) {
    throw new Error('No se ha podido actualizar la ubicación del producto.')
  }

  const { data: inventarioActualizado, error: errorInventario } = await supabase
    .from('inventario')
    .update(cambiosInventario)
    .eq('tienda_id', tienda.idBaseDatos)
    .eq('producto_id', producto.idBaseDatos)
    .select('id')
    .maybeSingle()

  if (errorInventario) {
    throw errorInventario
  }

  if (!inventarioActualizado) {
    throw new Error('No se ha podido actualizar el inventario del producto.')
  }

  await supabase.from('registros_actividad').insert({
    tienda_id: tienda.idBaseDatos,
    tipo_entidad: 'producto',
    entidad_id: producto.idBaseDatos,
    accion: 'empleado_actualiza_producto',
    datos_antes: productoAnterior ? obtenerDatosRegistroProducto(productoAnterior) : null,
    datos_despues: obtenerDatosRegistroProducto({
      ...productoLimpio,
      cantidad,
    }),
  })

  return {
    origen: 'supabase',
  }
}

export const crearProductoTienda = async ({ producto, secciones, tienda }) => {
  const productoLimpio = {
    ...producto,
    pasillo: cleanTextInput(producto.pasillo, 60),
    disponibilidad: cleanTextInput(producto.disponibilidad, 30),
    marca: cleanTextInput(producto.marca, 80),
    nombre: cleanTextInput(producto.nombre, 120),
    codigoSeccion: cleanTextInput(producto.codigoSeccion, 80),
    estanteria: cleanTextInput(producto.estanteria, 80),
  }
  const cantidad = obtenerCantidadEntera(productoLimpio.cantidad)
  const seccion = secciones.find((item) => item.codigo === productoLimpio.codigoSeccion)

  if (!seccion) {
    throw new Error('Selecciona una sección válida.')
  }

  const aliasBusqueda = obtenerAliasProducto(productoLimpio, seccion)
  const categoria = seccion.etiqueta

  if (!isSupabaseConfigured || !supabase) {
    const productoCreado = {
      id: crearCodigo(`${productoLimpio.nombre} ${productoLimpio.marca}`) || `producto-${Date.now()}`,
      idBaseDatos: null,
      nombre: productoLimpio.nombre,
      marca: productoLimpio.marca || 'Marca propia',
      categoria,
      codigoSeccion: seccion.codigo,
      idBaseDatosSeccion: seccion.idBaseDatos,
      pasillo: productoLimpio.pasillo,
      estanteria: productoLimpio.estanteria,
      disponibilidad: productoLimpio.disponibilidad,
      cantidad,
      aliasBusqueda,
    }

    return {
      producto: productoCreado,
      mensaje: 'Producto creado en modo demo.',
      origen: 'demo',
    }
  }

  if (!tienda.idBaseDatos) {
    throw new Error('No se ha cargado la tienda real de Supabase.')
  }

  const { data, error } = await supabase.functions.invoke('crear-producto', {
    body: {
      aliasBusqueda,
      pasillo: productoLimpio.pasillo,
      disponibilidad: productoLimpio.disponibilidad,
      marca: productoLimpio.marca,
      nombre: productoLimpio.nombre,
      cantidad,
      codigoSeccion: productoLimpio.codigoSeccion,
      estanteria: productoLimpio.estanteria,
      codigoTienda: tienda.codigo,
    },
  })

  if (error) {
    throw new Error(await obtenerMensajeErrorFuncion(error))
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    producto: formatearProductoCreado(data.producto),
    mensaje: data?.mensaje ?? 'Producto creado correctamente.',
    origen: 'supabase',
  }
}

export const eliminarProductoTienda = async ({ producto, tienda }) => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      producto: {
        id: producto.id,
      },
      mensaje: 'Producto eliminado en modo demo.',
      origen: 'demo',
    }
  }

  if (!tienda.idBaseDatos || !producto.idBaseDatos) {
    throw new Error('No se ha cargado la tienda real de Supabase.')
  }

  const { data, error } = await supabase.functions.invoke('eliminar-producto', {
    body: {
      productoId: producto.idBaseDatos,
      codigoTienda: tienda.codigo,
    },
  })

  if (error) {
    throw new Error(await obtenerMensajeErrorFuncion(error))
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    producto: data.producto,
    mensaje: data?.mensaje ?? 'Producto eliminado correctamente.',
    origen: 'supabase',
  }
}

export const obtenerDatosTienda = async (codigoTienda = CODIGO_TIENDA_PREDETERMINADA, { allowDemoFallback = true } = {}) => {
  if (!isSupabaseConfigured || !supabase) {
    return obtenerDatosTiendaDemo()
  }

  try {
    return await obtenerDatosTiendaSupabase(codigoTienda)
  } catch (error) {
    if (!allowDemoFallback) {
      throw error
    }

    return obtenerDatosTiendaDemo(error.message)
  }
}
