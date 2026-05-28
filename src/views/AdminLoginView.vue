<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getVerifiedSession } from '@/services/sesionAuth'
import { cleanEmailInput } from '@/services/security'
import { obtenerEmpleadoActual } from '@/services/datosTienda'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const authError = ref('')
const enviando = ref(false)

const getRedirectPath = () => {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
}

const showEmployeeAccessError = () => {
  authError.value = 'Tu usuario existe, pero no está dado de alta como empleado de la tienda.'
}

const showEmployeeCheckError = () => {
  authError.value = 'No se ha podido comprobar el acceso de empleado.'
}

const showSessionExpiredError = () => {
  authError.value = 'La sesión anterior ya no es válida. Inicia sesión de nuevo.'
}

const iniciarSesion = async () => {
  authError.value = ''

  if (!isSupabaseConfigured || !supabase) {
    await router.replace('/admin')
    return
  }

  enviando.value = true

  try {
    email.value = cleanEmailInput(email.value)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) {
      authError.value = 'No se ha podido iniciar sesión. Revisa el email y la contraseña.'
      return
    }

    const { user } = await getVerifiedSession()
    const { empleado } = await obtenerEmpleadoActual({ completeOnboarding: false })

    if (empleado) {
      password.value = ''
      await router.replace(getRedirectPath())
      return
    }

    if (user?.app_metadata?.invitacion_empleado) {
      password.value = ''
      await router.replace({ name: 'admin-setup-password' })
      return
    }

    await supabase.auth.signOut()
    showEmployeeAccessError()
  } catch {
    authError.value = 'No se ha podido comprobar el acceso de empleado.'
  } finally {
    password.value = ''
    enviando.value = false
  }
}

onMounted(async () => {
  if (!isSupabaseConfigured || !supabase) {
    return
  }

  const { isStale, session, user } = await getVerifiedSession()

  if (session) {
    const { empleado } = await obtenerEmpleadoActual({ completeOnboarding: false })

    if (empleado) {
      await router.replace(getRedirectPath())
      return
    }

    if (user.app_metadata?.invitacion_empleado) {
      await router.replace({ name: 'admin-setup-password' })
      return
    }

    await supabase.auth.signOut()
    showEmployeeAccessError()
    return
  }

  if (isStale || route.query.reason === 'session-expired') {
    showSessionExpiredError()
    return
  }

  if (route.query.reason === 'empleado-check-failed') {
    showEmployeeCheckError()
    return
  }

  if (route.query.reason === 'empleado-required') {
    showEmployeeAccessError()
  }
})
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>Acceso</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación">
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
      </nav>
    </header>

    <section class="tarjeta-login-admin" aria-labelledby="admin-login-title">
      <div>
        <p class="texto-superior">Panel interno</p>
        <h2 id="admin-login-title">Empleado</h2>
      </div>

      <RouterLink v-if="!isSupabaseConfigured" class="boton-admin" to="/admin">
        Entrar en modo demo
      </RouterLink>

      <form v-else class="formulario-login-admin" @submit.prevent="iniciarSesion">
        <label>
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="email" required />
        </label>

        <label>
          <span>Contraseña</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>

        <button type="submit" :disabled="enviando">
          {{ enviando ? 'Entrando' : 'Entrar' }}
        </button>

        <RouterLink class="enlace-secundario-admin" :to="{ name: 'admin-reset-password' }">
          He olvidado mi contraseña
        </RouterLink>

        <p v-if="authError" class="error-formulario">{{ authError }}</p>
      </form>
    </section>
  </main>
</template>
