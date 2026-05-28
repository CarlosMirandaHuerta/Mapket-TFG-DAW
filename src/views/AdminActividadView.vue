<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { CODIGO_TIENDA_PREDETERMINADA, obtenerRegistrosActividad, obtenerEmpleadoActual } from '@/services/datosTienda'
import { puedeGestionarEquipo } from '@/services/permisosEquipo'

const router = useRouter()
const registros = ref([])
const origen = ref('demo')
const cargando = ref(true)
const empleadoActual = ref(null)

const etiquetaEstado = {
  disponible: 'Disponible',
  pocas_unidades: 'Pocas unidades',
  agotado: 'Agotado',
}

const etiquetaCampo = {
  codigoSeccion: 'Sección',
  pasillo: 'Pasillo',
  estanteria: 'Estantería',
  cantidad: 'Cantidad',
  disponibilidad: 'Estado',
}

const camposSeguidos = ['codigoSeccion', 'pasillo', 'estanteria', 'cantidad', 'disponibilidad']

const totalProductosModificados = computed(() => {
  return new Set(registros.value.map((log) => log.nombreProducto)).size
})

const etiquetaOrigen = computed(() => {
  return origen.value === 'supabase' ? 'Supabase' : 'Demo'
})

const puedeGestionarEquipoSection = computed(() => {
  return !isSupabaseConfigured || puedeGestionarEquipo(empleadoActual.value)
})

const formatearFecha = (dateValue) => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(dateValue))
}

const formatearValor = (campo, value) => {
  if (campo === 'disponibilidad') {
    return etiquetaEstado[value] ?? 'Sin estado'
  }

  return value ?? 'Sin dato'
}

const obtenerCambios = (log) => {
  return camposSeguidos
    .filter((campo) => log.datosAntes?.[campo] !== log.datosDespues?.[campo])
    .map((campo) => ({
      campo,
      etiqueta: etiquetaCampo[campo],
      antes: formatearValor(campo, log.datosAntes?.[campo]),
      despues: formatearValor(campo, log.datosDespues?.[campo]),
    }))
}

const cargarActividad = async () => {
  cargando.value = true

  const [actividad, resultadoEmpleado] = await Promise.all([
    obtenerRegistrosActividad(CODIGO_TIENDA_PREDETERMINADA),
    obtenerEmpleadoActual().catch(() => ({ empleado: null })),
  ])

  registros.value = actividad.registros
  empleadoActual.value = resultadoEmpleado.empleado
  origen.value = actividad.origen
  cargando.value = false
}

const cerrarSesion = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return
  }

  await supabase.auth.signOut()
  await router.push({ name: 'admin-login' })
}

onMounted(cargarActividad)
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>Actividad</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación del equipo">
        <RouterLink class="enlace-nav-admin" to="/admin">Inventario</RouterLink>
        <RouterLink class="enlace-nav-admin" to="/admin/secciones">QR</RouterLink>
        <RouterLink class="enlace-nav-admin esta-actual" to="/admin/actividad">Actividad</RouterLink>
        <RouterLink v-if="puedeGestionarEquipoSection" class="enlace-nav-admin" to="/admin/empleados">Empleados</RouterLink>
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
        <button v-if="isSupabaseConfigured" class="boton-nav-admin" type="button" @click="cerrarSesion">
          Salir
        </button>
      </nav>
    </header>

    <section class="estadisticas-admin" aria-label="Resumen de actividad">
      <div>
        <strong>{{ registros.length }}</strong>
        <span>cambios</span>
      </div>
      <div>
        <strong>{{ totalProductosModificados }}</strong>
        <span>productos</span>
      </div>
      <div>
        <strong>{{ etiquetaOrigen }}</strong>
        <span>origen</span>
      </div>
    </section>

    <section class="lista-actividad" aria-label="Historial de cambios">
      <article v-if="cargando" class="elemento-actividad">
        <p class="texto-superior">Cargando</p>
        <h2>Revisando cambios</h2>
      </article>

      <article v-for="log in registros" v-else :key="log.id" class="elemento-actividad">
        <header>
          <div>
            <p class="texto-superior">{{ formatearFecha(log.creadoEn) }}</p>
            <h2>{{ log.nombreProducto }}</h2>
          </div>
          <span>{{ obtenerCambios(log).length }} cambios</span>
        </header>

        <ul>
          <li v-for="cambio in obtenerCambios(log)" :key="`${log.id}-${cambio.campo}`">
            <strong>{{ cambio.etiqueta }}</strong>
            <span>{{ cambio.antes }} a {{ cambio.despues }}</span>
          </li>
        </ul>
      </article>

      <article v-if="!cargando && registros.length === 0" class="elemento-actividad">
        <p class="texto-superior">Sin actividad</p>
        <h2>No hay cambios registrados</h2>
      </article>
    </section>
  </main>
</template>
