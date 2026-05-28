import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const cleanIdentifierInput = (value, maxLength = 80) => {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .trim()
    .slice(0, maxLength)
}

const limpiarCodigoInput = (value, maxLength = 80) => {
  return cleanIdentifierInput(value, maxLength).toLowerCase()
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

const puedeEliminarProductos = (rol) => {
  return ['admin', 'encargado'].includes(rol)
}

const getJoinedRecord = (record) => {
  return Array.isArray(record) ? record[0] : record
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

  const productoId = cleanIdentifierInput(body.productoId)
  const codigoTienda = limpiarCodigoInput(body.codigoTienda ?? 'tienda-demo')

  if (!productoId) {
    return jsonResponse({ error: 'Selecciona un producto para eliminar.' }, 400)
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

  if (!puedeEliminarProductos(empleadoActual.rol)) {
    return jsonResponse({ error: 'Solo un encargado o administrador puede eliminar productos.' }, 403)
  }

  const { data: tienda, error: errorTienda } = await adminClient
    .from('tiendas')
    .select('id, codigo')
    .eq('codigo', codigoTienda)
    .maybeSingle()

  if (errorTienda || !tienda) {
    return jsonResponse({ error: 'No se ha encontrado la tienda.' }, 404)
  }

  if (tienda.id !== empleadoActual.tienda_id) {
    return jsonResponse({ error: 'No puedes eliminar productos de esta tienda.' }, 403)
  }

  const { data: ubicacion, error: errorUbicacion } = await adminClient
    .from('ubicaciones_productos')
    .select(`
      id,
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
    .eq('producto_id', productoId)
    .maybeSingle()

  if (errorUbicacion) {
    return jsonResponse({ error: 'No se ha podido cargar el producto seleccionado.' }, 500)
  }

  if (!ubicacion) {
    return jsonResponse({ error: 'No se ha encontrado ese producto en tu tienda.' }, 404)
  }

  const producto = getJoinedRecord(ubicacion.producto)
  const seccion = getJoinedRecord(ubicacion.seccion)

  if (!producto) {
    return jsonResponse({ error: 'No se ha podido cargar la ficha del producto.' }, 500)
  }

  const { data: inventario, error: errorInventario } = await adminClient
    .from('inventario')
    .select('cantidad, estado')
    .eq('tienda_id', tienda.id)
    .eq('producto_id', producto.id)
    .maybeSingle()

  if (errorInventario) {
    return jsonResponse({ error: 'No se ha podido cargar el inventario del producto.' }, 500)
  }

  const categoria = getJoinedRecord(producto.categoria)
  const datosAntes = {
    aliasBusqueda: producto.alias_busqueda ?? [],
    pasillo: ubicacion.pasillo,
    disponibilidad: inventario?.estado ?? 'disponible',
    marca: producto.marca ?? 'Marca propia',
    categoria: categoria?.nombre ?? 'Sin categoría',
    idBaseDatos: producto.id,
    id: producto.codigo,
    nombre: producto.nombre,
    cantidad: inventario?.cantidad ?? 0,
    codigoSeccion: seccion?.codigo ?? '',
    estanteria: ubicacion.estanteria,
  }

  const { error: errorEliminacionInventario } = await adminClient
    .from('inventario')
    .delete()
    .eq('tienda_id', tienda.id)
    .eq('producto_id', producto.id)

  if (errorEliminacionInventario) {
    return jsonResponse({ error: 'No se ha podido eliminar el inventario del producto.' }, 500)
  }

  const { error: locationDeleteError } = await adminClient
    .from('ubicaciones_productos')
    .delete()
    .eq('tienda_id', tienda.id)
    .eq('producto_id', producto.id)

  if (locationDeleteError) {
    return jsonResponse({ error: 'No se ha podido eliminar la ubicación del producto.' }, 500)
  }

  const { count, error: remainingLocationsError } = await adminClient
    .from('ubicaciones_productos')
    .select('id', { count: 'exact', head: true })
    .eq('producto_id', producto.id)

  if (remainingLocationsError) {
    return jsonResponse({ error: 'No se ha podido comprobar el catálogo de productos.' }, 500)
  }

  if ((count ?? 0) === 0) {
    const { error: errorEliminacionProducto } = await adminClient.from('productos').delete().eq('id', producto.id)

    if (errorEliminacionProducto) {
      return jsonResponse({ error: 'El producto se ha quitado de la tienda, pero no del catálogo global.' }, 500)
    }
  }

  const { error: errorActividad } = await adminClient.from('registros_actividad').insert({
    accion: 'empleado_elimina_producto',
    datos_despues: null,
    datos_antes: datosAntes,
    empleado_id: empleadoActual.id,
    entidad_id: producto.id,
    tipo_entidad: 'producto',
    tienda_id: tienda.id,
  })

  if (errorActividad) {
    console.error(errorActividad)
  }

  return jsonResponse({
    mensaje: 'Producto eliminado correctamente.',
    producto: {
      idBaseDatos: producto.id,
      id: producto.codigo,
      nombre: producto.nombre,
    },
  })
})
