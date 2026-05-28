<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import ResultadosProductos from '@/components/ResultadosProductos.vue'
import DetallesSeccion from '@/components/DetallesSeccion.vue'
import MapaTienda from '@/components/MapaTienda.vue'
import { cleanSearchInput } from '@/services/security'
import { CODIGO_TIENDA_PREDETERMINADA, obtenerDatosTienda } from '@/services/datosTienda'

const route = useRoute()
const search = ref('')
const categoriaActiva = ref('Todas')
const codigoSeccionSeleccionada = ref('')
const idProductoSeleccionado = ref('')
const secciones = ref([])
const productos = ref([])
const tienda = ref({
  nombre: 'Tienda Demo',
  codigo: CODIGO_TIENDA_PREDETERMINADA,
})

const seccionRespaldo = {
  codigo: 'entrada',
  etiqueta: 'Entrada',
  pasillo: 'Acceso principal',
  categorias: [],
  productosDestacados: [],
}

const normalizeText = (value) => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

const codigoTienda = computed(() => {
  const value = route.params.codigoTienda
  return typeof value === 'string' ? value : CODIGO_TIENDA_PREDETERMINADA
})

const nombreTienda = computed(() => {
  return tienda.value.nombre ?? codigoTienda.value.replaceAll('-', ' ')
})

const codigoSeccionActual = computed(() => {
  const value = route.query.from
  return typeof value === 'string' ? value : 'entrada'
})

const seccionActual = computed(() => {
  return (
    secciones.value.find((seccion) => seccion.codigo === codigoSeccionActual.value) ??
    secciones.value[0] ??
    seccionRespaldo
  )
})

const resultadoProductoSeleccionado = computed(() => {
  return productos.value.find((producto) => producto.id === idProductoSeleccionado.value) ?? null
})

const seccionSeleccionada = computed(() => {
  const productoSeleccionado = resultadoProductoSeleccionado.value
  const codigoObjetivo = productoSeleccionado?.codigoSeccion ?? codigoSeccionSeleccionada.value
  return secciones.value.find((seccion) => seccion.codigo === codigoObjetivo) ?? seccionActual.value
})

watch(
  codigoTienda,
  async (codigo) => {
    const datosTienda = await obtenerDatosTienda(codigo)

    tienda.value = datosTienda.tienda
    secciones.value = datosTienda.secciones
    productos.value = datosTienda.productos
    idProductoSeleccionado.value = ''
    codigoSeccionSeleccionada.value = seccionActual.value.codigo
  },
  { immediate: true },
)

watch(codigoSeccionActual, () => {
  idProductoSeleccionado.value = ''
  codigoSeccionSeleccionada.value = seccionActual.value.codigo
})

const totalCategories = computed(() => {
  return secciones.value.reduce((total, seccion) => total + seccion.categorias.length, 0)
})

const categorias = computed(() => {
  return ['Todas', ...new Set(productos.value.map((producto) => producto.categoria))]
})

const productosFiltrados = computed(() => {
  const query = normalizeText(cleanSearchInput(search.value))
  const categoria = categoriaActiva.value

  return productos.value.filter((producto) => {
    const coincideCategoria = categoria === 'Todas' || producto.categoria === categoria
    const textoBusqueda = normalizeText(
      [producto.nombre, producto.marca, producto.categoria, ...producto.aliasBusqueda].join(' '),
    )

    return coincideCategoria && (query.length === 0 || textoBusqueda.includes(query))
  })
})

const seleccionarProducto = (producto) => {
  idProductoSeleccionado.value = producto.id
  codigoSeccionSeleccionada.value = producto.codigoSeccion
}

const seleccionarSeccion = (codigo) => {
  idProductoSeleccionado.value = ''
  codigoSeccionSeleccionada.value = codigo
}

const limpiarSeleccionProducto = () => {
  idProductoSeleccionado.value = ''
}

const seleccionarCategoria = (categoria) => {
  categoriaActiva.value = categoria
  limpiarSeleccionProducto()
}
</script>

<template>
  <main class="mobile-shell">
    <section class="panel-superior" aria-labelledby="tienda-title">
      <div>
        <p class="texto-superior">Mapket</p>
        <h1 id="tienda-title">{{ nombreTienda }}</h1>
      </div>
      <RouterLink class="admin-link" to="/admin">Equipo</RouterLink>
    </section>

    <section class="panel-busqueda" aria-label="Buscador de productos">
      <label class="campo-busqueda">
        <span>Buscar producto</span>
        <input v-model="search" type="search" placeholder="Yogures, arroz, detergente" />
      </label>

      <div class="ubicacion-chip">
        <span>Estás en&nbsp;</span>
        <strong>{{ seccionActual.etiqueta }}</strong>
      </div>
    </section>

    <section class="filtro-categorias" aria-label="Filtros por categoría">
      <button
        v-for="categoria in categorias"
        :key="categoria"
        :class="{ 'esta-activo': categoria === categoriaActiva }"
        type="button"
        @click="seleccionarCategoria(categoria)"
      >
        {{ categoria }}
      </button>
    </section>

    <ResultadosProductos
      :productos="productosFiltrados"
      :id-producto-seleccionado="idProductoSeleccionado"
      @seleccionar="seleccionarProducto"
    />

    <section class="resumen-tienda" aria-label="Resumen de tienda">
      <div>
        <strong>{{ secciones.length }}</strong>
        <span>secciones</span>
      </div>
      <div>
        <strong>{{ totalCategories }}</strong>
        <span>categorías</span>
      </div>
      <div>
        <strong>{{ seccionSeleccionada.pasillo }}</strong>
        <span>selección</span>
      </div>
    </section>

    <MapaTienda
      :secciones="secciones"
      :codigo-actual="seccionActual.codigo"
      :codigo-seleccionado="seccionSeleccionada.codigo"
      @seleccionar="seleccionarSeccion"
    />

    <DetallesSeccion
      :seccion="seccionSeleccionada"
      :seccion-actual="seccionActual"
      :producto-seleccionado="resultadoProductoSeleccionado"
    />
  </main>
</template>
