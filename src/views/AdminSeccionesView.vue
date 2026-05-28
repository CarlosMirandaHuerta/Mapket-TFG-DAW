<script setup>
import QRCode from 'qrcode'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { CODIGO_TIENDA_PREDETERMINADA, obtenerEmpleadoActual, obtenerDatosTienda } from '@/services/datosTienda'
import { puedeGestionarEquipo } from '@/services/permisosEquipo'

const router = useRouter()

const tienda = ref({
  nombre: 'Tienda Demo',
  codigo: CODIGO_TIENDA_PREDETERMINADA,
})
const secciones = ref([])
const qrCodes = ref({})
const codigoCopiado = ref('')
const cargando = ref(true)
const empleadoActual = ref(null)

const puedeGestionarEquipoSection = computed(() => {
  return !isSupabaseConfigured || puedeGestionarEquipo(empleadoActual.value)
})

const getSectionUrl = (seccion) => {
  const origin = typeof window === 'undefined' ? 'https://mapket.example' : window.location.origin
  const url = new URL(`/s/${tienda.value.codigo}`, origin)

  url.searchParams.set('from', seccion.codigo)

  return url.toString()
}

const tarjetasSeccion = computed(() => {
  return secciones.value.map((seccion) => ({
    ...seccion,
    qrCode: qrCodes.value[seccion.codigo] ?? '',
    url: getSectionUrl(seccion),
  }))
})

const crearCodigosQr = async () => {
  const nextQrCodes = {}

  await Promise.all(
    secciones.value.map(async (seccion) => {
      nextQrCodes[seccion.codigo] = await QRCode.toDataURL(getSectionUrl(seccion), {
        color: {
          dark: '#17211c',
          light: '#fffdf8',
        },
        margin: 2,
        width: 220,
      })
    }),
  )

  qrCodes.value = nextQrCodes
}

const loadSections = async () => {
  cargando.value = true

  const [datosTienda, resultadoEmpleado] = await Promise.all([
    obtenerDatosTienda(CODIGO_TIENDA_PREDETERMINADA),
    obtenerEmpleadoActual().catch(() => ({ empleado: null })),
  ])

  tienda.value = datosTienda.tienda
  empleadoActual.value = resultadoEmpleado.empleado
  secciones.value = datosTienda.secciones
  await crearCodigosQr()
  cargando.value = false
}

const copiarUrlSeccion = async (seccion) => {
  try {
    await navigator.clipboard.writeText(getSectionUrl(seccion))
    codigoCopiado.value = seccion.codigo
  } catch {
    codigoCopiado.value = ''
  }
}

const cerrarSesion = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return
  }

  await supabase.auth.signOut()
  await router.push({ name: 'admin-login' })
}

onMounted(loadSections)
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>QR de secciones</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación del equipo">
        <RouterLink class="enlace-nav-admin" to="/admin">Inventario</RouterLink>
        <RouterLink class="enlace-nav-admin esta-actual" to="/admin/secciones">QR</RouterLink>
        <RouterLink class="enlace-nav-admin" to="/admin/actividad">Actividad</RouterLink>
        <RouterLink v-if="puedeGestionarEquipoSection" class="enlace-nav-admin" to="/admin/empleados">Empleados</RouterLink>
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
        <button v-if="isSupabaseConfigured" class="boton-nav-admin" type="button" @click="cerrarSesion">
          Salir
        </button>
      </nav>
    </header>

    <section class="estadisticas-admin" aria-label="Resumen de códigos QR">
      <div>
        <strong>{{ secciones.length }}</strong>
        <span>secciones</span>
      </div>
      <div>
        <strong>{{ tienda.codigo }}</strong>
        <span>tienda</span>
      </div>
      <div>
        <strong>{{ codigoCopiado || 'listos' }}</strong>
        <span>copiado</span>
      </div>
    </section>

    <section class="cuadricula-qr" aria-label="Códigos QR por sección">
      <article v-if="cargando" class="tarjeta-qr">
        <p class="texto-superior">Cargando</p>
        <h2>Preparando códigos</h2>
      </article>

      <article v-for="seccion in tarjetasSeccion" v-else :key="seccion.codigo" class="tarjeta-qr">
        <header>
          <span class="qr-color" :style="{ background: seccion.color }"></span>
          <div>
            <p class="texto-superior">{{ seccion.pasillo }}</p>
            <h2>{{ seccion.etiqueta }}</h2>
          </div>
        </header>

        <div class="qr-image-frame">
          <img v-if="seccion.qrCode" :alt="`QR ${seccion.etiqueta}`" :src="seccion.qrCode" />
        </div>

        <code>{{ seccion.url }}</code>

        <div class="acciones-tarjeta-qr">
          <a :href="seccion.url" target="_blank" rel="noreferrer">Abrir</a>
          <button type="button" @click="copiarUrlSeccion(seccion)">
            {{ codigoCopiado === seccion.codigo ? 'Copiado' : 'Copiar URL' }}
          </button>
          <a v-if="seccion.qrCode" :download="`mapket-${seccion.codigo}.png`" :href="seccion.qrCode">
            PNG
          </a>
        </div>
      </article>
    </section>
  </main>
</template>
