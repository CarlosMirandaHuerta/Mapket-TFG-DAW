import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const getVerifiedSession = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return {
      isStale: false,
      session: null,
      user: null,
    }
  }

  const { data: datosSesion, error: errorSesion } = await supabase.auth.getSession()

  if (errorSesion || !datosSesion.session) {
    return {
      error: errorSesion,
      isStale: false,
      session: null,
      user: null,
    }
  }

  const { data: datosUsuario, error: errorUsuario } = await supabase.auth.getUser()

  if (errorUsuario || !datosUsuario.user) {
    await supabase.auth.signOut()

    return {
      error: errorUsuario,
      isStale: true,
      session: null,
      user: null,
    }
  }

  return {
    isStale: false,
    session: datosSesion.session,
    user: datosUsuario.user,
  }
}
