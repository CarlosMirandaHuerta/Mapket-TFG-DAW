<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getVerifiedSession } from '@/services/sesionAuth'
import { cleanEmailInput } from '@/services/security'
import { obtenerEmpleadoActual } from '@/services/datosTienda'

const router = useRouter()

const email = ref('')
const accountEmail = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const resetError = ref('')
const resetMessage = ref('')
const cargandoSession = ref(true)
const pidiendoEmail = ref(false)
const actualizandoContrasena = ref(false)
const tieneSesionRecuperacion = ref(false)

const minimumPasswordLength = 8
const urlProduccionRestablecerContrasena = 'https://mapket-web.vercel.app/admin/reset-password'

const getResetRedirectTo = () => {
  if (window.location.origin.startsWith('https://')) {
    return `${window.location.origin}/admin/reset-password`
  }

  return urlProduccionRestablecerContrasena
}

const loadSession = async () => {
  if (!isSupabaseConfigured || !supabase) {
    cargandoSession.value = false
    return
  }

  const { session, user } = await getVerifiedSession()

  tieneSesionRecuperacion.value = Boolean(session)
  accountEmail.value = user?.email ?? ''
  cargandoSession.value = false
}

const pedirEmailRestablecimiento = async () => {
  resetError.value = ''
  resetMessage.value = ''

  if (!isSupabaseConfigured || !supabase) {
    resetMessage.value = 'El modo demo no necesita recuperación de contraseña.'
    return
  }

  email.value = cleanEmailInput(email.value)

  if (!email.value) {
    resetError.value = 'Introduce tu email.'
    return
  }

  pidiendoEmail.value = true

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: getResetRedirectTo(),
    })

    if (error) {
      resetError.value = 'No se ha podido enviar el email de recuperación.'
      return
    }

    resetMessage.value = 'Email enviado. Revisa tu bandeja de entrada.'
    email.value = ''
  } catch {
    resetError.value = 'No se ha podido enviar el email de recuperación.'
  } finally {
    pidiendoEmail.value = false
  }
}

const actualizarContrasena = async () => {
  resetError.value = ''
  resetMessage.value = ''

  if (password.value.length < minimumPasswordLength) {
    resetError.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    resetError.value = 'Las contraseñas no coinciden.'
    return
  }

  actualizandoContrasena.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    })

    if (error) {
      resetError.value = 'No se ha podido actualizar la contraseña.'
      return
    }

    const { empleado } = await obtenerEmpleadoActual({ completeOnboarding: false })

    password.value = ''
    passwordConfirmation.value = ''
    resetMessage.value = 'Contraseña actualizada correctamente.'

    if (empleado) {
      await router.replace('/admin')
      return
    }

    await supabase.auth.signOut()
    await router.replace({
      name: 'admin-login',
      query: {
        reason: 'empleado-required',
      },
    })
  } catch {
    resetError.value = 'No se ha podido actualizar la contraseña.'
  } finally {
    password.value = ''
    passwordConfirmation.value = ''
    actualizandoContrasena.value = false
  }
}

onMounted(loadSession)
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>Recuperar contraseña</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación">
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
      </nav>
    </header>

    <section class="tarjeta-login-admin" aria-labelledby="reset-password-title">
      <div>
        <p class="texto-superior">Acceso interno</p>
        <h2 id="reset-password-title">
          {{ tieneSesionRecuperacion ? 'Nueva contraseña' : 'Email de recuperación' }}
        </h2>
      </div>

      <p v-if="cargandoSession" class="nota-guardado">Comprobando sesión.</p>

      <RouterLink v-else-if="!isSupabaseConfigured" class="boton-admin" to="/admin">
        Entrar en modo demo
      </RouterLink>

      <form v-else-if="tieneSesionRecuperacion" class="formulario-login-admin" @submit.prevent="actualizarContrasena">
        <div class="resumen-cuenta-admin">
          <span>Email</span>
          <strong>{{ accountEmail }}</strong>
        </div>

        <label>
          <span>Nueva contraseña</span>
          <input v-model="password" type="password" autocomplete="new-password" required />
        </label>

        <label>
          <span>Repetir contraseña</span>
          <input v-model="passwordConfirmation" type="password" autocomplete="new-password" required />
        </label>

        <button type="submit" :disabled="actualizandoContrasena">
          {{ actualizandoContrasena ? 'Actualizando' : 'Actualizar contraseña' }}
        </button>

        <p v-if="resetMessage" class="nota-guardado">{{ resetMessage }}</p>
        <p v-if="resetError" class="error-formulario">{{ resetError }}</p>
      </form>

      <form v-else class="formulario-login-admin" @submit.prevent="pedirEmailRestablecimiento">
        <label>
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="email" required />
        </label>

        <button type="submit" :disabled="pidiendoEmail">
          {{ pidiendoEmail ? 'Enviando' : 'Enviar email' }}
        </button>

        <RouterLink class="enlace-secundario-admin" :to="{ name: 'admin-login' }">
          Volver al acceso
        </RouterLink>

        <p v-if="resetMessage" class="nota-guardado">{{ resetMessage }}</p>
        <p v-if="resetError" class="error-formulario">{{ resetError }}</p>
      </form>
    </section>
  </main>
</template>
