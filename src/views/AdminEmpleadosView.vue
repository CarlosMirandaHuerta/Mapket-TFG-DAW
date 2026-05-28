<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { cleanEmailInput, cleanTextInput } from '@/services/security'
import { eliminarEmpleado, obtenerEmpleadosTienda, invitarEmpleado } from '@/services/datosTienda'
import { puedeGestionarEquipo } from '@/services/permisosEquipo'

const router = useRouter()

const etiquetaRol = {
  admin: 'Administrador',
  encargado: 'Encargado',
  empleado: 'Empleado',
}

const rolesInvitacionPorRol = {
  admin: ['empleado', 'encargado', 'admin'],
  encargado: ['empleado'],
  empleado: [],
}

const rolesEliminacionPorRol = {
  admin: ['empleado', 'encargado', 'admin'],
  encargado: ['empleado'],
  empleado: [],
}

const empleados = ref([])
const empleadoActual = ref(null)
const origen = ref('demo')
const errorCarga = ref('')
const mensajeInvitacion = ref('')
const errorInvitacion = ref('')
const mensajeEmpleado = ref('')
const errorEmpleado = ref('')
const cargando = ref(true)
const enviando = ref(false)
const idEmpleadoEliminando = ref('')

const form = reactive({
  email: '',
  nombre: '',
  rol: 'empleado',
})

const etiquetaOrigen = computed(() => {
  return origen.value === 'supabase' ? 'Supabase' : 'Demo'
})

const etiquetaRolActual = computed(() => {
  return etiquetaRol[empleadoActual.value?.rol] ?? 'Sin rol'
})

const opcionesRolInvitacion = computed(() => {
  const roles = rolesInvitacionPorRol[empleadoActual.value?.rol] ?? []

  return roles.map((rol) => ({
    etiqueta: etiquetaRol[rol],
    value: rol,
  }))
})

const puedeInvitar = computed(() => {
  return opcionesRolInvitacion.value.length > 0
})

const puedeGestionarEmpleados = computed(() => {
  return !isSupabaseConfigured || puedeGestionarEquipo(empleadoActual.value)
})

const emailValido = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const totalEncargados = computed(() => {
  return empleados.value.filter((empleado) => ['admin', 'encargado'].includes(empleado.rol)).length
})

const totalAdmins = computed(() => {
  return empleados.value.filter((empleado) => empleado.rol === 'admin').length
})

const urlProduccionCrearPasswordAdmin = 'https://mapket-web.vercel.app/admin/setup-password'

const formatearFecha = (dateValue) => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateValue))
}

const obtenerRedireccion = () => {
  if (typeof window === 'undefined') {
    return urlProduccionCrearPasswordAdmin
  }

  if (!window.location.origin.startsWith('https://')) {
    return urlProduccionCrearPasswordAdmin
  }

  return `${window.location.origin}/admin/setup-password`
}

const sincronizarRolDefecto = () => {
  if (!opcionesRolInvitacion.value.some((option) => option.value === form.rol)) {
    form.rol = opcionesRolInvitacion.value[0]?.value ?? 'empleado'
  }
}

const cargarEmpleados = async ({ silent = false } = {}) => {
  if (!silent) {
    cargando.value = true
  }

  const result = await obtenerEmpleadosTienda()

  empleados.value = result.empleados
  empleadoActual.value = result.empleadoActual
  origen.value = result.origen
  errorCarga.value = result.mensajeError
  sincronizarRolDefecto()

  if (!silent) {
    cargando.value = false
  }
}

const limpiarAvisoInvitacion = () => {
  mensajeInvitacion.value = ''
  errorInvitacion.value = ''
}

const limpiarAvisoEmpleado = () => {
  mensajeEmpleado.value = ''
  errorEmpleado.value = ''
}

const reiniciarFormulario = () => {
  form.email = ''
  form.nombre = ''
  sincronizarRolDefecto()
}

const puedeEliminarEmpleado = (empleado) => {
  if (!empleadoActual.value || empleado.id === empleadoActual.value.id) {
    return false
  }

  const deletableRoles = rolesEliminacionPorRol[empleadoActual.value.rol] ?? []

  if (!deletableRoles.includes(empleado.rol)) {
    return false
  }

  return empleado.rol !== 'admin' || totalAdmins.value > 1
}

const enviarInvitacion = async () => {
  limpiarAvisoInvitacion()
  limpiarAvisoEmpleado()

  const email = cleanEmailInput(form.email)
  const nombre = cleanTextInput(form.nombre, 80)

  form.email = email
  form.nombre = nombre

  if (!puedeInvitar.value) {
    errorInvitacion.value = 'Tu rol no permite invitar empleados.'
    return
  }

  if (nombre.length < 2) {
    errorInvitacion.value = 'El nombre debe tener al menos 2 caracteres.'
    return
  }

  if (!emailValido(email)) {
    errorInvitacion.value = 'Introduce un email válido.'
    return
  }

  enviando.value = true

  try {
    const result = await invitarEmpleado({
      email,
      nombre,
      redirectTo: obtenerRedireccion(),
      rol: form.rol,
    })

    mensajeInvitacion.value = result.mensaje
    reiniciarFormulario()

    if (result.origen === 'supabase') {
      await cargarEmpleados()
      return
    }

    if (result.empleado) {
      empleados.value = [result.empleado, ...empleados.value]
    }
  } catch (error) {
    errorInvitacion.value = error.message || 'No se ha podido enviar la invitación.'
  } finally {
    enviando.value = false
  }
}

const eliminarEmpleadoSeleccionado = async (empleado) => {
  limpiarAvisoInvitacion()
  limpiarAvisoEmpleado()

  if (!puedeEliminarEmpleado(empleado)) {
    errorEmpleado.value = 'No tienes permisos para eliminar ese empleado.'
    return
  }

  const shouldDelete = window.confirm(`¿Eliminar a ${empleado.nombre} del equipo? Esta acción no se puede deshacer.`)

  if (!shouldDelete) {
    return
  }

  idEmpleadoEliminando.value = empleado.id

  try {
    const result = await eliminarEmpleado(empleado.id)

    empleados.value = empleados.value.filter((item) => item.id !== empleado.id)
    mensajeEmpleado.value = result.mensaje
  } catch (error) {
    errorEmpleado.value = error.message || 'No se ha podido eliminar el empleado.'
  } finally {
    idEmpleadoEliminando.value = ''
  }
}

const actualizarEmpleados = async () => {
  if (enviando.value || idEmpleadoEliminando.value) {
    return
  }

  await cargarEmpleados({ silent: true })
}

const manejarCambioVisibilidad = () => {
  if (!document.hidden) {
    actualizarEmpleados()
  }
}

const cerrarSesion = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return
  }

  await supabase.auth.signOut()
  await router.push({ name: 'admin-login' })
}

let temporizadorActualizacion = null

onMounted(() => {
  cargarEmpleados()

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', actualizarEmpleados)
    document.addEventListener('visibilitychange', manejarCambioVisibilidad)
    temporizadorActualizacion = window.setInterval(actualizarEmpleados, 15000)
  }
})

onUnmounted(() => {
  if (typeof window === 'undefined') {
    return
  }

  window.removeEventListener('focus', actualizarEmpleados)
  document.removeEventListener('visibilitychange', manejarCambioVisibilidad)

  if (temporizadorActualizacion) {
    window.clearInterval(temporizadorActualizacion)
  }
})
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>Empleados</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación del equipo">
        <RouterLink class="enlace-nav-admin" to="/admin">Inventario</RouterLink>
        <RouterLink class="enlace-nav-admin" to="/admin/secciones">QR</RouterLink>
        <RouterLink class="enlace-nav-admin" to="/admin/actividad">Actividad</RouterLink>
        <RouterLink class="enlace-nav-admin esta-actual" to="/admin/empleados">Empleados</RouterLink>
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
        <button v-if="isSupabaseConfigured" class="boton-nav-admin" type="button" @click="cerrarSesion">
          Salir
        </button>
      </nav>
    </header>

    <section class="estadisticas-admin" aria-label="Resumen de empleados">
      <div>
        <strong>{{ empleados.length }}</strong>
        <span>empleados</span>
      </div>
      <div>
        <strong>{{ totalEncargados }}</strong>
        <span>responsables</span>
      </div>
      <div>
        <strong>{{ etiquetaOrigen }}</strong>
        <span>origen</span>
      </div>
    </section>

    <p v-if="errorCarga" class="error-formulario mensaje-pagina-empleado">{{ errorCarga }}</p>
    <p v-if="mensajeEmpleado" class="nota-guardado mensaje-pagina-empleado">{{ mensajeEmpleado }}</p>
    <p v-if="errorEmpleado" class="error-formulario mensaje-pagina-empleado">{{ errorEmpleado }}</p>

    <section class="espacio-empleados">
      <section class="lista-empleados" aria-label="Listado de empleados">
        <article v-if="cargando" class="tarjeta-empleado">
          <p class="texto-superior">Cargando</p>
          <h2>Revisando empleados</h2>
        </article>

        <article v-for="empleado in empleados" v-else :key="empleado.id" class="tarjeta-empleado">
          <header>
            <div>
              <p class="texto-superior">{{ formatearFecha(empleado.creadoEn) }}</p>
              <h2>{{ empleado.nombre }}</h2>
            </div>
            <div class="acciones-tarjeta-empleado">
              <span>{{ etiquetaRol[empleado.rol] ?? empleado.rol }}</span>
              <button
                v-if="puedeEliminarEmpleado(empleado)"
                class="boton-eliminar-empleado"
                type="button"
                :disabled="idEmpleadoEliminando === empleado.id"
                @click="eliminarEmpleadoSeleccionado(empleado)"
              >
                {{ idEmpleadoEliminando === empleado.id ? 'Eliminando' : 'Eliminar' }}
              </button>
            </div>
          </header>
        </article>

        <article v-if="!cargando && empleados.length === 0" class="tarjeta-empleado">
          <p class="texto-superior">Sin empleados</p>
          <h2>No hay empleados registrados</h2>
        </article>
      </section>

      <form v-if="puedeGestionarEmpleados && puedeInvitar" class="editor-inventario formulario-invitar-empleado" @submit.prevent="enviarInvitacion">
        <div class="cabecera-editor">
          <div>
            <p class="texto-superior">{{ etiquetaRolActual }}</p>
            <h2>Invitar empleado</h2>
          </div>
        </div>

        <label>
          <span>Nombre</span>
          <input v-model="form.nombre" type="text" autocomplete="nombre" required @input="limpiarAvisoInvitacion" />
        </label>

        <label>
          <span>Email</span>
          <input v-model="form.email" type="email" autocomplete="email" required @input="limpiarAvisoInvitacion" />
        </label>

        <label>
          <span>Rol</span>
          <select v-model="form.rol" :disabled="!puedeInvitar" @change="limpiarAvisoInvitacion">
            <option v-for="option in opcionesRolInvitacion" :key="option.value" :value="option.value">
              {{ option.etiqueta }}
            </option>
          </select>
        </label>

        <button type="submit" :disabled="enviando || !puedeInvitar">
          {{ enviando ? 'Enviando' : 'Enviar invitación' }}
        </button>

        <p v-if="mensajeInvitacion" class="nota-guardado">{{ mensajeInvitacion }}</p>
        <p v-if="errorInvitacion" class="error-formulario">{{ errorInvitacion }}</p>
      </form>
    </section>
  </main>
</template>
