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

const invitacionValida = (invitacion) => {
  return Boolean(
    invitacion
      && typeof invitacion.nombre === 'string'
      && typeof invitacion.rol === 'string'
      && typeof invitacion.tienda_id === 'string'
      && ['empleado', 'encargado', 'admin'].includes(invitacion.rol),
  )
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

  const { data: empleadoExistente, error: errorEmpleadoExistente } = await adminClient
    .from('empleados')
    .select('id, nombre, rol, tienda_id, creado_en')
    .eq('usuario_auth_id', datosUsuario.user.id)
    .maybeSingle()

  if (errorEmpleadoExistente) {
    return jsonResponse({ error: 'No se ha podido comprobar el empleado actual.' }, 500)
  }

  if (empleadoExistente) {
    const { invitacion_empleado: _invitacionEmpleado, ...metadataRestante } = datosUsuario.user.app_metadata ?? {}

    if (datosUsuario.user.app_metadata?.invitacion_empleado) {
      await adminClient.auth.admin.updateUserById(datosUsuario.user.id, {
        app_metadata: {
          ...metadataRestante,
          estado_empleado: 'accepted',
        },
      })
    }

    return jsonResponse({
      empleado: empleadoExistente,
      mensaje: 'Empleado ya registrado.',
    })
  }

  const invitacion = datosUsuario.user.app_metadata?.invitacion_empleado

  if (!invitacionValida(invitacion)) {
    return jsonResponse({ error: 'No hay una invitación válida para este usuario.' }, 403)
  }

  const { data: empleado, error: errorInsercion } = await adminClient
    .from('empleados')
    .insert({
      usuario_auth_id: datosUsuario.user.id,
      nombre: cleanTextInput(invitacion.nombre, 80),
      rol: invitacion.rol,
      tienda_id: invitacion.tienda_id,
    })
    .select('id, nombre, rol, tienda_id, creado_en')
    .single()

  if (errorInsercion) {
    if (errorInsercion.code === '23505') {
      const { data: empleadoTrasConflicto, error: errorEmpleadoTrasConflicto } = await adminClient
        .from('empleados')
        .select('id, nombre, rol, tienda_id, creado_en')
        .eq('usuario_auth_id', datosUsuario.user.id)
        .maybeSingle()

      if (errorEmpleadoTrasConflicto || !empleadoTrasConflicto) {
        return jsonResponse({ error: 'No se ha podido completar el alta del empleado.' }, 500)
      }

      return jsonResponse({
        empleado: empleadoTrasConflicto,
        mensaje: 'Empleado ya registrado.',
      })
    }

    return jsonResponse({ error: 'No se ha podido completar el alta del empleado.' }, 500)
  }

  const { invitacion_empleado: _invitacionEmpleado, ...metadataRestante } = datosUsuario.user.app_metadata ?? {}

  await adminClient.auth.admin.updateUserById(datosUsuario.user.id, {
    app_metadata: {
      ...metadataRestante,
      estado_empleado: 'accepted',
    },
  })

  await adminClient.from('registros_actividad').insert({
    accion: 'empleado_acepta_invitacion',
    datos_despues: {
      id: empleado.id,
      nombre: empleado.nombre,
      rol: empleado.rol,
    },
    datos_antes: {
      email: datosUsuario.user.email,
      rol: invitacion.rol,
      estado: 'pending',
    },
    empleado_id: empleado.id,
    entidad_id: empleado.id,
    tipo_entidad: 'empleado',
    tienda_id: empleado.tienda_id,
  })

  return jsonResponse({
    empleado,
    mensaje: 'Empleado registrado correctamente.',
  })
})
