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

const puedeEliminarRol = (rolActual, rolObjetivo) => {
  if (rolActual === 'admin') {
    return ['empleado', 'encargado', 'admin'].includes(rolObjetivo)
  }

  if (rolActual === 'encargado') {
    return rolObjetivo === 'empleado'
  }

  return false
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

  const empleadoId = cleanIdentifierInput(body.empleadoId)

  if (!empleadoId) {
    return jsonResponse({ error: 'Selecciona un empleado para eliminar.' }, 400)
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

  const { data: empleadoObjetivo, error: errorEmpleadoObjetivo } = await adminClient
    .from('empleados')
    .select('id, usuario_auth_id, nombre, rol, tienda_id')
    .eq('id', empleadoId)
    .maybeSingle()

  if (errorEmpleadoObjetivo) {
    return jsonResponse({ error: 'No se ha podido cargar el empleado seleccionado.' }, 500)
  }

  if (!empleadoObjetivo || empleadoObjetivo.tienda_id !== empleadoActual.tienda_id) {
    return jsonResponse({ error: 'No se ha encontrado ese empleado en tu tienda.' }, 404)
  }

  if (empleadoObjetivo.id === empleadoActual.id || empleadoObjetivo.usuario_auth_id === datosUsuario.user.id) {
    return jsonResponse({ error: 'No puedes eliminar tu propio usuario.' }, 400)
  }

  if (!puedeEliminarRol(empleadoActual.rol, empleadoObjetivo.rol)) {
    return jsonResponse({ error: 'No tienes permisos para eliminar ese empleado.' }, 403)
  }

  if (empleadoObjetivo.rol === 'admin') {
    const { count, error: totalAdminsError } = await adminClient
      .from('empleados')
      .select('id', { count: 'exact', head: true })
      .eq('tienda_id', empleadoActual.tienda_id)
      .eq('rol', 'admin')

    if (totalAdminsError) {
      return jsonResponse({ error: 'No se ha podido comprobar el equipo de administradores.' }, 500)
    }

    if ((count ?? 0) <= 1) {
      return jsonResponse({ error: 'No puedes eliminar el último administrador de la tienda.' }, 400)
    }
  }

  const { error: errorEliminacionAuth } = await adminClient.auth.admin.deleteUser(empleadoObjetivo.usuario_auth_id)

  if (errorEliminacionAuth) {
    const { error: eliminarEmpleadoError } = await adminClient
      .from('empleados')
      .delete()
      .eq('id', empleadoObjetivo.id)
      .eq('tienda_id', empleadoActual.tienda_id)

    if (eliminarEmpleadoError) {
      return jsonResponse({ error: 'No se ha podido eliminar el empleado.' }, 500)
    }
  }

  await adminClient.from('registros_actividad').insert({
    accion: 'empleado_elimina',
    datos_despues: null,
    datos_antes: {
      id: empleadoObjetivo.id,
      nombre: empleadoObjetivo.nombre,
      rol: empleadoObjetivo.rol,
    },
    empleado_id: empleadoActual.id,
    entidad_id: empleadoObjetivo.id,
    tipo_entidad: 'empleado',
    tienda_id: empleadoActual.tienda_id,
  })

  return jsonResponse({
    empleado: {
      id: empleadoObjetivo.id,
      nombre: empleadoObjetivo.nombre,
      rol: empleadoObjetivo.rol,
    },
    mensaje: errorEliminacionAuth
      ? 'Empleado eliminado del equipo. Revisa Supabase Auth si quieres borrar también el usuario de autenticación.'
      : 'Empleado eliminado del equipo.',
  })
})
