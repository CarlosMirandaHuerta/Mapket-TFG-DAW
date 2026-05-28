import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const estadosValidos = ['disponible', 'pocas_unidades', 'agotado']
const controlCharacters = /[\u0000-\u001f\u007f]/g
const riskyTextCharacters = /[<>`{}]/g

const cleanTextInput = (value, maxLength = 120) => {
  const cleanValue = String(value ?? '')
    .replace(controlCharacters, ' ')
    .replace(riskyTextCharacters, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleanValue.slice(0, maxLength)
}

const limpiarCodigoInput = (value, maxLength = 80) => {
  return cleanTextInput(value, maxLength)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
}

const jsonResponse = (body, httpStatus = 200) => {
  return Response.json(body, {
    status: httpStatus,
    headers: corsHeaders,
  })
}

const getJsonSecret = (nombre) => {
  const value = Deno.env.get(nombre)

  if (!value) {
    return ''
  }

  try {
    const parsedValue = JSON.parse(value)
    return parsedValue.default ?? Object.values(parsedValue)[0] ?? ''
  } catch {
    return ''
  }
}

const getRequiredEnv = (nombre, fallback = '') => {
  const value = Deno.env.get(nombre) ?? fallback

  if (!value) {
    throw new Error(`Falta la variable ${nombre}.`)
  }

  return value
}

const getSupabaseConfig = () => {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const publishableKey = getRequiredEnv(
    'SUPABASE_ANON_KEY',
    getJsonSecret('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
  )
  const serviceKey = getRequiredEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    getJsonSecret('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SECRET_KEY'),
  )

  return {
    publishableKey,
    serviceKey,
    supabaseUrl,
  }
}

const getRequestBody = async (request) => {
  try {
    return await request.json()
  } catch {
    return null
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

const obtenerCantidad = (valorCantidad) => {
  const cantidad = Number(valorCantidad)

  if (!Number.isFinite(cantidad) || cantidad < 0) {
    return 0
  }

  return Math.trunc(cantidad)
}

const obtenerDatosProducto = (body) => {
  const nombre = cleanTextInput(body.nombre, 120)
  const marca = cleanTextInput(body.marca, 80) || 'Marca propia'
  const nombreCategoria = cleanTextInput(body.categoria, 80)
  const codigoSeccion = limpiarCodigoInput(body.codigoSeccion)
  const pasillo = cleanTextInput(body.pasillo, 60)
  const estanteria = cleanTextInput(body.estanteria, 80)
  const codigoTienda = limpiarCodigoInput(body.codigoTienda ?? 'tienda-demo')
  const disponibilidad = cleanTextInput(body.disponibilidad ?? 'disponible', 30)
  const codigo_barras = cleanTextInput(body.codigo_barras, 80)
  const aliasBusqueda = obtenerListaAlias(body.aliasBusqueda)
  const cantidad = obtenerCantidad(body.cantidad)

  return {
    aliasBusqueda,
    pasillo,
    disponibilidad,
    codigo_barras,
    marca,
    nombreCategoria,
    nombre,
    cantidad,
    codigoSeccion,
    estanteria,
    codigoTienda,
  }
}

const validarDatosProducto = (datosProducto) => {
  if (datosProducto.nombre.length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.'
  }

  if (!datosProducto.codigoSeccion) {
    return 'Selecciona una sección.'
  }

  if (datosProducto.pasillo.length < 2) {
    return 'Indica el pasillo del producto.'
  }

  if (datosProducto.estanteria.length < 2) {
    return 'Indica la estantería del producto.'
  }

  if (!estadosValidos.includes(datosProducto.disponibilidad)) {
    return 'El estado del producto no es válido.'
  }

  return ''
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  const authorization = request.headers.get('Authorization')

  if (!authorization) {
    return jsonResponse({ error: 'Debes iniciar sesión.' }, 401)
  }

  const body = await getRequestBody(request)

  if (!body) {
    return jsonResponse({ error: 'La petición no contiene datos válidos.' }, 400)
  }

  const datosProducto = obtenerDatosProducto(body)
  const errorValidacion = validarDatosProducto(datosProducto)

  if (errorValidacion) {
    return jsonResponse({ error: errorValidacion }, 400)
  }

  let supabaseConfig

  try {
    supabaseConfig = getSupabaseConfig()
  } catch {
    return jsonResponse({ error: 'No se ha podido cargar la configuración de Supabase.' }, 500)
  }

  const { publishableKey, serviceKey, supabaseUrl } = supabaseConfig
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  })
  const adminClient = createClient(supabaseUrl, serviceKey)

  const { data: datosUsuario, error: errorUsuario } = await userClient.auth.getUser()

  if (errorUsuario || !datosUsuario.user) {
    return jsonResponse({ error: 'Sesión no válida.' }, 401)
  }

  const { data: empleadoActual, error: errorEmpleado } = await adminClient
    .from('empleados')
    .select('id, rol, tienda_id')
    .eq('usuario_auth_id', datosUsuario.user.id)
    .maybeSingle()

  if (errorEmpleado) {
    return jsonResponse({ error: 'No se ha podido comprobar el empleado actual.' }, 500)
  }

  if (!empleadoActual) {
    return jsonResponse({ error: 'Tu usuario no está registrado como empleado.' }, 403)
  }

  const { data: tienda, error: errorTienda } = await adminClient
    .from('tiendas')
    .select('id, codigo')
    .eq('codigo', datosProducto.codigoTienda)
    .maybeSingle()

  if (errorTienda || !tienda) {
    return jsonResponse({ error: 'No se ha encontrado la tienda.' }, 404)
  }

  if (tienda.id !== empleadoActual.tienda_id) {
    return jsonResponse({ error: 'No puedes crear productos en esta tienda.' }, 403)
  }

  const { data: seccion, error: errorSeccion } = await adminClient
    .from('secciones')
    .select('id, nombre, codigo')
    .eq('tienda_id', tienda.id)
    .eq('codigo', datosProducto.codigoSeccion)
    .maybeSingle()

  if (errorSeccion || !seccion) {
    return jsonResponse({ error: 'No se ha encontrado la sección seleccionada.' }, 404)
  }

  const nombreCategoria = datosProducto.nombreCategoria || seccion.nombre
  const aliasProducto =
    datosProducto.aliasBusqueda.length > 0
      ? datosProducto.aliasBusqueda
      : obtenerListaAlias([datosProducto.nombre, datosProducto.marca, nombreCategoria, seccion.nombre, seccion.codigo])
  const codigoCategoria = crearCodigo(nombreCategoria)
  const codigoProducto = crearCodigo(`${datosProducto.nombre} ${datosProducto.marca}`)

  if (!codigoCategoria || !codigoProducto) {
    return jsonResponse({ error: 'No se ha podido generar el identificador del producto.' }, 400)
  }

  const { data: categoria, error: errorCategoria } = await adminClient
    .from('categorias')
    .upsert(
      {
        nombre: nombreCategoria,
        codigo: codigoCategoria,
      },
      {
        onConflict: 'codigo',
      },
    )
    .select('id, nombre, codigo')
    .single()

  if (errorCategoria) {
    return jsonResponse({ error: 'No se ha podido guardar la categoría.' }, 500)
  }

  const cambiosProducto = {
    categoria_id: categoria.id,
    nombre: datosProducto.nombre,
    codigo: codigoProducto,
    marca: datosProducto.marca,
    alias_busqueda: aliasProducto,
    ...(datosProducto.codigo_barras ? { codigo_barras: datosProducto.codigo_barras } : {}),
  }
  const { data: producto, error: errorProducto } = await adminClient
    .from('productos')
    .upsert(cambiosProducto, {
      onConflict: 'codigo',
    })
    .select('id, codigo, nombre, marca, alias_busqueda')
    .single()

  if (errorProducto) {
    return jsonResponse({ error: 'No se ha podido guardar el producto.' }, 500)
  }

  const { error: errorUbicacion } = await adminClient
    .from('ubicaciones_productos')
    .upsert(
      {
        pasillo: datosProducto.pasillo,
        producto_id: producto.id,
        seccion_id: seccion.id,
        estanteria: datosProducto.estanteria,
        tienda_id: tienda.id,
      },
      {
        onConflict: 'tienda_id,producto_id',
      },
    )

  if (errorUbicacion) {
    return jsonResponse({ error: 'No se ha podido guardar la ubicación del producto.' }, 500)
  }

  const { error: errorInventario } = await adminClient
    .from('inventario')
    .upsert(
      {
        producto_id: producto.id,
        cantidad: datosProducto.cantidad,
        estado: datosProducto.disponibilidad,
        tienda_id: tienda.id,
      },
      {
        onConflict: 'tienda_id,producto_id',
      },
    )

  if (errorInventario) {
    return jsonResponse({ error: 'No se ha podido guardar el inventario del producto.' }, 500)
  }

  const productoRespuesta = {
    aliasBusqueda: producto.alias_busqueda ?? [],
    pasillo: datosProducto.pasillo,
    disponibilidad: datosProducto.disponibilidad,
    marca: producto.marca ?? 'Marca propia',
    categoria: categoria.nombre,
    idBaseDatos: producto.id,
    id: producto.codigo,
    nombre: producto.nombre,
    cantidad: datosProducto.cantidad,
    idBaseDatosSeccion: seccion.id,
    codigoSeccion: seccion.codigo,
    estanteria: datosProducto.estanteria,
  }

  const { error: errorActividad } = await adminClient.from('registros_actividad').insert({
    accion: 'empleado_crea_producto',
    datos_despues: productoRespuesta,
    datos_antes: null,
    empleado_id: empleadoActual.id,
    entidad_id: producto.id,
    tipo_entidad: 'producto',
    tienda_id: tienda.id,
  })

  if (errorActividad) {
    console.error(errorActividad)
  }

  return jsonResponse({
    mensaje: 'Producto creado correctamente.',
    producto: productoRespuesta,
  })
})
