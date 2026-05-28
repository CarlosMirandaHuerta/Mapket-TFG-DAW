<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { cleanSearchInput, cleanTextInput } from '@/services/security'
import {
  CODIGO_TIENDA_PREDETERMINADA,
  crearProductoTienda,
  eliminarProductoTienda,
  obtenerEmpleadoActual,
  obtenerDatosTienda,
  guardarProductoTienda,
} from '@/services/datosTienda'
import { puedeGestionarEquipo } from '@/services/permisosEquipo'

const router = useRouter()

const etiquetaEstado = {
  disponible: 'Disponible',
  pocas_unidades: 'Pocas unidades',
  agotado: 'Agotado',
}

const opcionesEstado = [
  { value: 'all', etiqueta: 'Todos' },
  { value: 'disponible', etiqueta: etiquetaEstado.disponible },
  { value: 'pocas_unidades', etiqueta: etiquetaEstado.pocas_unidades },
  { value: 'agotado', etiqueta: etiquetaEstado.agotado },
]

const cantidadInicial = {
  disponible: 24,
  pocas_unidades: 5,
  agotado: 0,
}

const getNewProductDefaults = () => ({
  pasillo: '',
  disponibilidad: 'disponible',
  marca: '',
  nombre: '',
  cantidad: cantidadInicial.disponible,
  codigoSeccion: '',
  estanteria: '',
})

const search = ref('')
const filtroSeccion = ref('all')
const filtroEstado = ref('all')
const tienda = ref({
  nombre: 'Tienda Demo',
  codigo: CODIGO_TIENDA_PREDETERMINADA,
  idBaseDatos: null,
})
const secciones = ref([])
const productos = ref([])
const copiasProductosGuardados = ref({})
const idProductoSeleccionado = ref('')
const mensajeGuardado = ref('')
const errorGuardado = ref('')
const guardando = ref(false)
const mensajeEliminacion = ref('')
const errorEliminacion = ref('')
const eliminandoProducto = ref(false)
const mensajeCreacion = ref('')
const errorCreacion = ref('')
const creandoProducto = ref(false)
const errorCarga = ref('')
const empleadoActual = ref(null)
const nuevoProducto = reactive(getNewProductDefaults())

const normalizeText = (value) => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

const seccionesEditables = computed(() => {
  return secciones.value.filter((seccion) => seccion.codigo !== 'entrada')
})

const opcionesSeccion = computed(() => {
  return [{ codigo: 'all', etiqueta: 'Todas' }, ...seccionesEditables.value]
})

const nuevoProductoStockOptions = computed(() => {
  return opcionesEstado.filter((option) => option.value !== 'all')
})

const productosFiltrados = computed(() => {
  const query = normalizeText(cleanSearchInput(search.value))

  return productos.value.filter((producto) => {
    const coincideSeccion = filtroSeccion.value === 'all' || producto.codigoSeccion === filtroSeccion.value
    const coincideEstado = filtroEstado.value === 'all' || producto.disponibilidad === filtroEstado.value
    const textoBusqueda = normalizeText(
      [producto.nombre, producto.marca, producto.categoria, producto.pasillo, producto.estanteria].join(' '),
    )

    return coincideSeccion && coincideEstado && (query.length === 0 || textoBusqueda.includes(query))
  })
})

const productoSeleccionado = computed(() => {
  if (productosFiltrados.value.length === 0) {
    return null
  }

  return productos.value.find((producto) => producto.id === idProductoSeleccionado.value) ?? productosFiltrados.value[0]
})

watch(productosFiltrados, (siguientesProductos) => {
  if (siguientesProductos.length === 0) {
    return
  }

  const productoSeleccionadoIsVisible = siguientesProductos.some((producto) => producto.id === idProductoSeleccionado.value)

  if (!productoSeleccionadoIsVisible) {
    idProductoSeleccionado.value = siguientesProductos[0].id
  }
})

const totalPocasUnidades = computed(() => {
  return productos.value.filter((producto) => producto.disponibilidad === 'pocas_unidades').length
})

const totalAgotados = computed(() => {
  return productos.value.filter((producto) => producto.disponibilidad === 'agotado').length
})

const productosAtencion = computed(() => {
  const prioridadInventario = {
    agotado: 0,
    pocas_unidades: 1,
    disponible: 2,
  }

  return [...productos.value]
    .filter((producto) => producto.disponibilidad !== 'disponible')
    .sort((primerProducto, segundoProducto) => {
      const priorityDiff =
        prioridadInventario[primerProducto.disponibilidad] - prioridadInventario[segundoProducto.disponibilidad]

      if (priorityDiff !== 0) {
        return priorityDiff
      }

      return primerProducto.nombre.localeCompare(segundoProducto.nombre, 'es')
    })
})

const puedeGestionarEquipoSection = computed(() => {
  return !isSupabaseConfigured || puedeGestionarEquipo(empleadoActual.value)
})

const puedeEliminarProductos = computed(() => {
  return !isSupabaseConfigured || puedeGestionarEquipo(empleadoActual.value)
})

const puedeCrearProductos = computed(() => {
  return seccionesEditables.value.length > 0 && (!isSupabaseConfigured || Boolean(tienda.value.idBaseDatos))
})

const obtenerSeccionPorCodigo = (codigo) => {
  return secciones.value.find((seccion) => seccion.codigo === codigo) ?? null
}

const nombreSeccion = (codigo) => {
  return obtenerSeccionPorCodigo(codigo)?.etiqueta ?? 'Sin sección'
}

const obtenerOpcionesPasilloSeccion = (seccion) => {
  const etiquetaPasillo = cleanTextInput(seccion?.pasillo, 80)
  const numerosPasillo = etiquetaPasillo.match(/\d+/g) ?? []

  if (numerosPasillo.length > 0) {
    return numerosPasillo.map((numeroPasillo) => `Pasillo ${numeroPasillo}`)
  }

  return etiquetaPasillo ? [etiquetaPasillo] : []
}

const obtenerOpcionesPasilloPorSeccion = (codigoSeccion) => {
  return obtenerOpcionesPasilloSeccion(obtenerSeccionPorCodigo(codigoSeccion))
}

const ordenarProductos = (siguientesProductos) => {
  return [...siguientesProductos].sort((primerProducto, segundoProducto) =>
    primerProducto.nombre.localeCompare(segundoProducto.nombre, 'es'),
  )
}

const obtenerCopiaProducto = (producto) => {
  return {
    ...producto,
  }
}

const recordarProductosGuardados = () => {
  copiasProductosGuardados.value = Object.fromEntries(
    productos.value.map((producto) => [producto.id, obtenerCopiaProducto(producto)]),
  )
}

const setDefaultNewProductSection = () => {
  const seccionSeleccionadaExists = seccionesEditables.value.some((seccion) => seccion.codigo === nuevoProducto.codigoSeccion)

  if (!seccionSeleccionadaExists) {
    nuevoProducto.codigoSeccion = seccionesEditables.value[0]?.codigo ?? ''
  }

  asignarPasilloProductoPorDefecto(nuevoProducto)
}

const asignarPasilloProductoPorDefecto = (producto) => {
  const opcionesPasillo = obtenerOpcionesPasilloPorSeccion(producto.codigoSeccion)

  if (opcionesPasillo.length === 0) {
    producto.pasillo = ''
    return
  }

  if (!opcionesPasillo.includes(producto.pasillo)) {
    producto.pasillo = opcionesPasillo[0]
  }
}

const opcionesPasilloNuevoProducto = computed(() => {
  return obtenerOpcionesPasilloPorSeccion(nuevoProducto.codigoSeccion)
})

const opcionesPasilloProductoSeleccionado = computed(() => {
  return productoSeleccionado.value ? obtenerOpcionesPasilloPorSeccion(productoSeleccionado.value.codigoSeccion) : []
})

const reiniciarFormularioProducto = () => {
  Object.assign(nuevoProducto, getNewProductDefaults())
  setDefaultNewProductSection()
}

const obtenerBorradorProductoLimpio = (producto) => {
  return {
    pasillo: cleanTextInput(producto.pasillo, 60),
    disponibilidad: producto.disponibilidad,
    marca: cleanTextInput(producto.marca, 80),
    nombre: cleanTextInput(producto.nombre, 120),
    cantidad: producto.cantidad,
    codigoSeccion: cleanTextInput(producto.codigoSeccion, 80),
    estanteria: cleanTextInput(producto.estanteria, 80),
  }
}

const cargarInventario = async () => {
  errorCarga.value = ''

  try {
    const [datosTienda, resultadoEmpleado] = await Promise.all([
      obtenerDatosTienda(CODIGO_TIENDA_PREDETERMINADA, { allowDemoFallback: false }),
      obtenerEmpleadoActual().catch(() => ({ empleado: null })),
    ])

    tienda.value = datosTienda.tienda
    secciones.value = datosTienda.secciones
    empleadoActual.value = resultadoEmpleado.empleado
    productos.value = datosTienda.productos.map((producto) => ({
      ...producto,
      cantidad: producto.cantidad ?? cantidadInicial[producto.disponibilidad],
    }))
    recordarProductosGuardados()
    idProductoSeleccionado.value = productos.value[0]?.id ?? ''
    setDefaultNewProductSection()
  } catch (error) {
    errorCarga.value = error.message || 'No se ha podido cargar la tienda real de Supabase.'
    secciones.value = []
    productos.value = []
    idProductoSeleccionado.value = ''
  }
}

onMounted(cargarInventario)

const seleccionarProducto = (producto) => {
  idProductoSeleccionado.value = producto.id
  limpiarAvisoGuardado()
  limpiarAvisoEliminacion()
}

const seleccionarProductoAtencion = (producto) => {
  search.value = ''
  filtroSeccion.value = 'all'
  filtroEstado.value = producto.disponibilidad
  idProductoSeleccionado.value = producto.id
  limpiarAvisoGuardado()
  limpiarAvisoEliminacion()
}

const actualizarEstado = (producto, disponibilidad) => {
  producto.disponibilidad = disponibilidad

  if (disponibilidad === 'agotado') {
    producto.cantidad = 0
  }

  if (disponibilidad === 'pocas_unidades' && producto.cantidad === 0) {
    producto.cantidad = cantidadInicial.pocas_unidades
  }

  if (disponibilidad === 'disponible' && producto.cantidad <= cantidadInicial.pocas_unidades) {
    producto.cantidad = cantidadInicial.disponible
  }
}

const actualizarCantidad = (producto, valorCantidad) => {
  const cantidad = Number(valorCantidad)
  producto.cantidad = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0

  if (producto.cantidad === 0) {
    producto.disponibilidad = 'agotado'
    return
  }

  if (producto.cantidad <= cantidadInicial.pocas_unidades) {
    producto.disponibilidad = 'pocas_unidades'
    return
  }

  producto.disponibilidad = 'disponible'
}

const guardarCambios = async () => {
  if (!productoSeleccionado.value) {
    return
  }

  guardando.value = true
  errorGuardado.value = ''
  mensajeGuardado.value = ''

  try {
    const producto = productoSeleccionado.value
    producto.pasillo = cleanTextInput(producto.pasillo, 60)
    producto.estanteria = cleanTextInput(producto.estanteria, 80)

    const result = await guardarProductoTienda({
      tienda: tienda.value,
      secciones: secciones.value,
      producto,
      productoAnterior: copiasProductosGuardados.value[producto.id],
    })

    copiasProductosGuardados.value = {
      ...copiasProductosGuardados.value,
      [producto.id]: obtenerCopiaProducto(producto),
    }

    const savedAt = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())

    mensajeGuardado.value =
      result.origen === 'supabase'
        ? `Guardado en Supabase a las ${savedAt}`
        : `Modo demo actualizado a las ${savedAt}`
  } catch (error) {
    errorGuardado.value = error.message || 'No se han podido guardar los cambios en Supabase.'
  } finally {
    guardando.value = false
  }
}

const crearProducto = async () => {
  errorCreacion.value = ''
  mensajeCreacion.value = ''

  const borradorProducto = obtenerBorradorProductoLimpio(nuevoProducto)
  Object.assign(nuevoProducto, borradorProducto)

  if (borradorProducto.nombre.length < 2) {
    errorCreacion.value = 'El nombre debe tener al menos 2 caracteres.'
    return
  }

  if (!borradorProducto.codigoSeccion) {
    errorCreacion.value = 'Selecciona una sección.'
    return
  }

  if (borradorProducto.pasillo.length < 2 || borradorProducto.estanteria.length < 2) {
    errorCreacion.value = 'Indica pasillo y estantería.'
    return
  }

  if (isSupabaseConfigured && !tienda.value.idBaseDatos) {
    errorCreacion.value = 'No se ha cargado la tienda real de Supabase. Recarga el panel antes de crear productos.'
    return
  }

  creandoProducto.value = true

  try {
    const result = await crearProductoTienda({
      producto: borradorProducto,
      secciones: secciones.value,
      tienda: tienda.value,
    })

    const productoExiste = productos.value.some((producto) => producto.id === result.producto.id)
    const siguientesProductos = productoExiste
      ? productos.value.map((producto) => (producto.id === result.producto.id ? result.producto : producto))
      : [...productos.value, result.producto]

    productos.value = ordenarProductos(siguientesProductos)
    copiasProductosGuardados.value = {
      ...copiasProductosGuardados.value,
      [result.producto.id]: obtenerCopiaProducto(result.producto),
    }
    search.value = ''
    filtroSeccion.value = 'all'
    filtroEstado.value = 'all'
    idProductoSeleccionado.value = result.producto.id
    mensajeCreacion.value = result.mensaje
    reiniciarFormularioProducto()
  } catch (error) {
    errorCreacion.value = error.message || 'No se ha podido crear el producto.'
  } finally {
    creandoProducto.value = false
  }
}

const eliminarProductoSeleccionado = async () => {
  if (!productoSeleccionado.value || eliminandoProducto.value) {
    return
  }

  const producto = productoSeleccionado.value
  const confirmado = window.confirm(`¿Eliminar "${producto.nombre}" del inventario?`)

  if (!confirmado) {
    return
  }

  eliminandoProducto.value = true
  errorEliminacion.value = ''
  mensajeEliminacion.value = ''

  try {
    const result = await eliminarProductoTienda({
      producto,
      tienda: tienda.value,
    })
    const idProductoEliminado = producto.id
    const siguientesCopias = { ...copiasProductosGuardados.value }
    delete siguientesCopias[idProductoEliminado]

    productos.value = productos.value.filter((item) => item.id !== idProductoEliminado)
    copiasProductosGuardados.value = siguientesCopias
    idProductoSeleccionado.value = productosFiltrados.value[0]?.id ?? ''
    mensajeGuardado.value = ''
    errorGuardado.value = ''
    mensajeEliminacion.value = result.mensaje
  } catch (error) {
    errorEliminacion.value = error.message || 'No se ha podido eliminar el producto.'
  } finally {
    eliminandoProducto.value = false
  }
}

const limpiarAvisoGuardado = () => {
  mensajeGuardado.value = ''
  errorGuardado.value = ''
}

const limpiarAvisoEliminacion = () => {
  mensajeEliminacion.value = ''
  errorEliminacion.value = ''
}

const limpiarAvisoProducto = () => {
  limpiarAvisoGuardado()
  limpiarAvisoEliminacion()
}

const limpiarAvisoCreacion = () => {
  mensajeCreacion.value = ''
  errorCreacion.value = ''
}

const manejarCantidad = (producto, valorCantidad) => {
  actualizarCantidad(producto, valorCantidad)
  limpiarAvisoProducto()
}

const manejarCambioEstado = (producto, disponibilidad) => {
  actualizarEstado(producto, disponibilidad)
  limpiarAvisoProducto()
}

const manejarCambioSeccionProducto = (producto) => {
  asignarPasilloProductoPorDefecto(producto)
  limpiarAvisoProducto()
}

const manejarCantidadNuevoProducto = (valorCantidad) => {
  actualizarCantidad(nuevoProducto, valorCantidad)
  limpiarAvisoCreacion()
}

const manejarEstadoNuevoProducto = (disponibilidad) => {
  actualizarEstado(nuevoProducto, disponibilidad)
  limpiarAvisoCreacion()
}

const manejarSeccionNuevoProducto = () => {
  asignarPasilloProductoPorDefecto(nuevoProducto)
  limpiarAvisoCreacion()
}

const cerrarSesion = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return
  }

  await supabase.auth.signOut()
  await router.push({ name: 'admin-login' })
}
</script>

<template>
  <main class="admin-dashboard">
    <header class="barra-admin">
      <div>
        <p class="texto-superior">Mapket equipo</p>
        <h1>Inventario</h1>
      </div>

      <nav class="acciones-admin" aria-label="Navegación del equipo">
        <RouterLink class="enlace-nav-admin esta-actual" to="/admin">Inventario</RouterLink>
        <RouterLink class="enlace-nav-admin" to="/admin/secciones">QR</RouterLink>
        <RouterLink class="enlace-nav-admin" to="/admin/actividad">Actividad</RouterLink>
        <RouterLink v-if="puedeGestionarEquipoSection" class="enlace-nav-admin" to="/admin/empleados">Empleados</RouterLink>
        <RouterLink class="enlace-volver" to="/">Mapa</RouterLink>
        <button v-if="isSupabaseConfigured" class="boton-nav-admin" type="button" @click="cerrarSesion">
          Salir
        </button>
      </nav>
    </header>

    <section class="estadisticas-admin" aria-label="Resumen de inventario">
      <div>
        <strong>{{ productos.length }}</strong>
        <span>productos</span>
      </div>
      <div>
        <strong>{{ totalPocasUnidades }}</strong>
        <span>pocas unidades</span>
      </div>
      <div>
        <strong>{{ totalAgotados }}</strong>
        <span>agotados</span>
      </div>
    </section>

    <section class="panel-crear-producto" aria-label="Alta de producto">
      <header>
        <div>
          <p class="texto-superior">Alta rápida</p>
          <h2>Nuevo producto</h2>
        </div>
        <span>{{ mensajeCreacion ? 'creado' : 'CRUD' }}</span>
      </header>

      <form class="formulario-crear-producto" @submit.prevent="crearProducto">
        <div class="cuadricula-crear-producto">
          <label class="ancho">
            <span>Producto</span>
            <input v-model="nuevoProducto.nombre" type="text" required @input="limpiarAvisoCreacion" />
          </label>

          <label>
            <span>Marca</span>
            <input v-model="nuevoProducto.marca" type="text" @input="limpiarAvisoCreacion" />
          </label>

          <label>
            <span>Sección</span>
            <select v-model="nuevoProducto.codigoSeccion" required @change="manejarSeccionNuevoProducto">
              <option v-for="seccion in seccionesEditables" :key="seccion.codigo" :value="seccion.codigo">
                {{ seccion.etiqueta }}
              </option>
            </select>
          </label>

          <label>
            <span>Pasillo</span>
            <select v-model="nuevoProducto.pasillo" required @change="limpiarAvisoCreacion">
              <option v-for="pasillo in opcionesPasilloNuevoProducto" :key="pasillo" :value="pasillo">
                {{ pasillo }}
              </option>
            </select>
          </label>

          <label>
            <span>Estantería</span>
            <input v-model="nuevoProducto.estanteria" type="text" required @input="limpiarAvisoCreacion" />
          </label>

          <label>
            <span>Cantidad</span>
            <input
              :value="nuevoProducto.cantidad"
              min="0"
              type="number"
              @input="manejarCantidadNuevoProducto($event.target.value)"
            />
          </label>

          <label>
            <span>Estado</span>
            <select
              :value="nuevoProducto.disponibilidad"
              @change="manejarEstadoNuevoProducto($event.target.value)"
            >
              <option v-for="option in nuevoProductoStockOptions" :key="option.value" :value="option.value">
                {{ option.etiqueta }}
              </option>
            </select>
          </label>
        </div>

        <button type="submit" :disabled="creandoProducto || !puedeCrearProductos">
          {{ creandoProducto ? 'Creando' : 'Crear producto' }}
        </button>

        <p v-if="errorCarga" class="error-formulario">{{ errorCarga }}</p>
        <p v-if="mensajeCreacion" class="nota-guardado">{{ mensajeCreacion }}</p>
        <p v-if="errorCreacion" class="error-formulario">{{ errorCreacion }}</p>
      </form>
    </section>

    <section v-if="productosAtencion.length > 0" class="alertas-inventario" aria-label="Productos a revisar">
      <header>
        <div>
          <p class="texto-superior">Reposición</p>
          <h2>Productos a revisar</h2>
        </div>
        <span>{{ productosAtencion.length }} avisos</span>
      </header>

      <div class="lista-alertas-inventario">
        <button
          v-for="producto in productosAtencion"
          :key="producto.id"
          class="alerta-inventario"
          :class="`esta-${producto.disponibilidad}`"
          type="button"
          @click="seleccionarProductoAtencion(producto)"
        >
          <span>
            <strong>{{ producto.nombre }}</strong>
            <small>
              {{ nombreSeccion(producto.codigoSeccion) }} · {{ producto.pasillo }} ·
              {{ producto.cantidad }} uds.
            </small>
          </span>
          <em :class="['etiqueta-estado', producto.disponibilidad]">
            {{ etiquetaEstado[producto.disponibilidad] }}
          </em>
        </button>
      </div>
    </section>

    <section class="herramientas-admin" aria-label="Filtros de inventario">
      <label>
        <span>Buscar</span>
        <input v-model="search" type="search" placeholder="Yogur, detergente, pasillo..." />
      </label>

      <label>
        <span>Sección</span>
        <select v-model="filtroSeccion">
          <option v-for="seccion in opcionesSeccion" :key="seccion.codigo" :value="seccion.codigo">
            {{ seccion.etiqueta }}
          </option>
        </select>
      </label>

      <label>
        <span>Estado</span>
        <select v-model="filtroEstado">
          <option v-for="option in opcionesEstado" :key="option.value" :value="option.value">
            {{ option.etiqueta }}
          </option>
        </select>
      </label>
    </section>

    <p v-if="mensajeEliminacion" class="nota-guardado mensaje-pagina-inventario">{{ mensajeEliminacion }}</p>
    <p v-if="errorEliminacion" class="error-formulario mensaje-pagina-inventario">{{ errorEliminacion }}</p>

    <section class="espacio-admin">
      <div class="lista-inventario" aria-label="Productos">
        <button
          v-for="producto in productosFiltrados"
          :key="producto.id"
          class="fila-inventario"
          :class="{ 'esta-seleccionado': producto.id === productoSeleccionado?.id }"
          type="button"
          @click="seleccionarProducto(producto)"
        >
          <span>
            <strong>{{ producto.nombre }}</strong>
            <small>{{ producto.marca }} · {{ nombreSeccion(producto.codigoSeccion) }}</small>
          </span>
          <em :class="['etiqueta-estado', producto.disponibilidad]">
            {{ etiquetaEstado[producto.disponibilidad] }}
          </em>
        </button>

        <p v-if="productosFiltrados.length === 0" class="sin-resultados">Sin resultados</p>
      </div>

      <form v-if="productoSeleccionado" class="editor-inventario" @submit.prevent="guardarCambios">
        <div class="cabecera-editor">
          <div>
            <p class="texto-superior">Producto</p>
            <h2>{{ productoSeleccionado.nombre }}</h2>
            <span>{{ productoSeleccionado.marca }}</span>
          </div>
          <em :class="['etiqueta-estado', productoSeleccionado.disponibilidad]">
            {{ etiquetaEstado[productoSeleccionado.disponibilidad] }}
          </em>
        </div>

        <label>
          <span>Cantidad</span>
          <input
            :value="productoSeleccionado.cantidad"
            min="0"
            type="number"
            @input="manejarCantidad(productoSeleccionado, $event.target.value)"
          />
        </label>

        <label>
          <span>Estado</span>
          <select
            :value="productoSeleccionado.disponibilidad"
            @change="manejarCambioEstado(productoSeleccionado, $event.target.value)"
          >
            <option value="disponible">Disponible</option>
            <option value="pocas_unidades">Pocas unidades</option>
            <option value="agotado">Agotado</option>
          </select>
        </label>

        <label>
          <span>Sección</span>
          <select v-model="productoSeleccionado.codigoSeccion" @change="manejarCambioSeccionProducto(productoSeleccionado)">
            <option v-for="seccion in seccionesEditables" :key="seccion.codigo" :value="seccion.codigo">
              {{ seccion.etiqueta }}
            </option>
          </select>
        </label>

        <label>
          <span>Pasillo</span>
          <select v-model="productoSeleccionado.pasillo" @change="limpiarAvisoProducto">
            <option v-for="pasillo in opcionesPasilloProductoSeleccionado" :key="pasillo" :value="pasillo">
              {{ pasillo }}
            </option>
          </select>
        </label>

        <label>
          <span>Estantería</span>
          <input v-model="productoSeleccionado.estanteria" type="text" @input="limpiarAvisoProducto" />
        </label>

        <div class="acciones-editor">
          <button type="submit" :disabled="guardando || eliminandoProducto">
            {{ guardando ? 'Guardando' : 'Guardar cambios' }}
          </button>

          <button
            v-if="puedeEliminarProductos"
            class="boton-peligro-inventario"
            type="button"
            :disabled="eliminandoProducto || guardando"
            @click="eliminarProductoSeleccionado"
          >
            {{ eliminandoProducto ? 'Eliminando' : 'Eliminar producto' }}
          </button>
        </div>

        <p v-if="mensajeGuardado" class="nota-guardado">{{ mensajeGuardado }}</p>
        <p v-if="errorGuardado" class="error-formulario">{{ errorGuardado }}</p>
      </form>

      <div v-else class="editor-inventario editor-vacio">
        <p class="texto-superior">Producto</p>
        <h2>Sin resultados</h2>
        <span>Cambia la búsqueda o los filtros para editar un producto.</span>
      </div>
    </section>
  </main>
</template>
