<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getVerifiedSession } from '@/services/sesionAuth'
import { completarAltaEmpleado, obtenerEmpleadoActual } from '@/services/datosTienda'

const router = useRouter()

const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const setupError = ref('')
const setupMessage = ref('')
const cargandoSession = ref(true)
const enviando = ref(false)

const minimumPasswordLength = 8

const loadSession = async () => {
  if (!isSupabaseConfigured || !supabase) {
    await router.replace('/admin')
    return
  }

  const { isStale, session, user } = await getVerifiedSession()

  if (!session) {
    await router.replace({
      name: 'admin-login',
      query: {
        redirect: '/admin/setup-password',
        reason: isStale ? 'session-expired' : undefined,
      },
    })
    return
  }

  email.value = user.email ?? ''

  const { empleado } = await obtenerEmpleadoActual({ completeOnboarding: false })

  if (empleado) {
    await router.replace('/admin')
    return
  }

  cargandoSession.value = false
}

const enviarContrasena = async () => {
  setupError.value = ''
  setupMessage.value = ''

  if (password.value.length < minimumPasswordLength) {
    setupError.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    setupError.value = 'Las contraseñas no coinciden.'
    return
  }

  enviando.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    })

    if (error) {
      setupError.value = 'No se ha podido crear la contraseña.'
      return
    }

    const empleado = await completarAltaEmpleado()

    if (!empleado) {
      setupError.value = 'No se ha podido completar el alta del empleado.'
      return
    }

    await supabase.auth.refreshSession()
    password.value = ''
    passwordConfirmation.value = ''
    setupMessage.value = 'Contraseña creada correctamente.'
    await router.replace('/admin')
  } catch {
    setupError.value = 'No se ha podido completar el alta del empleado.'
  } finally {
    password.value = ''
    passwordConfirmation.value = ''
    enviando.value = false
  }
}

onMounted(loadSession)
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>Crear contraseña</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación">
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
      </nav>
    </header>

    <section class="tarjeta-login-admin" aria-labelledby="setup-password-title">
      <div>
        <p class="texto-superior">Primer acceso</p>
        <h2 id="setup-password-title">Cuenta de empleado</h2>
      </div>

      <p v-if="cargandoSession" class="nota-guardado">Comprobando invitación.</p>

      <form v-else class="formulario-login-admin" @submit.prevent="enviarContrasena">
        <div class="resumen-cuenta-admin">
          <span>Email</span>
          <strong>{{ email }}</strong>
        </div>

        <label>
          <span>Contraseña</span>
          <input v-model="password" type="password" autocomplete="new-password" required />
        </label>

        <label>
          <span>Repetir contraseña</span>
          <input v-model="passwordConfirmation" type="password" autocomplete="new-password" required />
        </label>

        <button type="submit" :disabled="enviando">
          {{ enviando ? 'Creando' : 'Crear contraseña' }}
        </button>

        <p v-if="setupMessage" class="nota-guardado">{{ setupMessage }}</p>
        <p v-if="setupError" class="error-formulario">{{ setupError }}</p>
      </form>
    </section>
  </main>
</template>
