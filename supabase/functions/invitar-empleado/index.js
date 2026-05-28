import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

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

const cleanEmailInput = (value) => {
  return cleanTextInput(value, 254).toLowerCase()
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

const emailValido = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const urlProduccionCrearPasswordAdmin = 'https://mapket-web.vercel.app/admin/setup-password'

const obtenerRolesPermitidos = (rol) => {
  if (rol === 'admin') {
    return ['empleado', 'encargado', 'admin']
  }

  if (rol === 'encargado') {
    return ['empleado']
  }

  return []
}

const obtenerRedireccion = () => {
  return urlProduccionCrearPasswordAdmin
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

  const email = cleanEmailInput(body.email)
  const nombre = cleanTextInput(body.nombre, 80)
  const rolSolicitado = cleanTextInput(body.rol ?? 'empleado', 20)

  if (!emailValido(email)) {
    return jsonResponse({ error: 'El email no es válido.' }, 400)
  }

  if (nombre.length < 2) {
    return jsonResponse({ error: 'El nombre debe tener al menos 2 caracteres.' }, 400)
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

  const rolesPermitidos = obtenerRolesPermitidos(empleadoActual.rol)

  if (!rolesPermitidos.includes(rolSolicitado)) {
    return jsonResponse({ error: 'No tienes permisos para asignar ese rol.' }, 403)
  }

  const { data: usuarioInvitado, error: errorInvitacion } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        nombre,
        rol: rolSolicitado,
      },
      redirectTo: obtenerRedireccion(),
    },
  )

  if (errorInvitacion || !usuarioInvitado.user) {
    return jsonResponse({ error: errorInvitacion?.message ?? 'No se ha podido invitar al empleado.' }, 400)
  }

  const { error: errorMetadata } = await adminClient.auth.admin.updateUserById(usuarioInvitado.user.id, {
    app_metadata: {
      ...(usuarioInvitado.user.app_metadata ?? {}),
      invitacion_empleado: {
        invitado_por_empleado_id: empleadoActual.id,
        nombre,
        rol: rolSolicitado,
        tienda_id: empleadoActual.tienda_id,
      },
    },
  })

  if (errorMetadata) {
    await adminClient.auth.admin.deleteUser(usuarioInvitado.user.id)
    return jsonResponse({ error: 'No se ha podido preparar el alta del empleado.' }, 500)
  }

  await adminClient.from('registros_actividad').insert({
    accion: 'empleado_invita',
    datos_despues: {
      email,
      nombre,
      rol: rolSolicitado,
      estado: 'pending',
    },
    datos_antes: null,
    empleado_id: empleadoActual.id,
    entidad_id: usuarioInvitado.user.id,
    tipo_entidad: 'invitacion_empleado',
    tienda_id: empleadoActual.tienda_id,
  })

  return jsonResponse({
    empleado: {
      creado_en: usuarioInvitado.user.creado_en ?? new Date().toISOString(),
      id: usuarioInvitado.user.id,
      nombre,
      rol: rolSolicitado,
    },
    invitation: {
      email,
      nombre,
      rol: rolSolicitado,
    },
    mensaje: 'Invitación enviada. El empleado aparecerá cuando acepte el email.',
  })
})
