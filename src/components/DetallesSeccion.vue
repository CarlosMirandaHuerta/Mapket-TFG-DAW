<script setup>
import { computed } from 'vue'

const props = defineProps({
  seccion: {
    type: Object,
    required: true,
  },
  seccionActual: {
    type: Object,
    default: null,
  },
  productoSeleccionado: {
    type: Object,
    default: null,
  },
})

const etiquetaEstado = {
  disponible: 'Disponible',
  pocas_unidades: 'Pocas unidades',
  agotado: 'Agotado',
}

const hayPistaRuta = computed(() => {
  return (
    props.productoSeleccionado &&
    props.seccionActual &&
    props.seccionActual.codigo !== props.seccion.codigo
  )
})
</script>

<template>
  <section class="detalles-seccion" aria-labelledby="titulo-detalles-seccion">
    <div class="cabecera-detalles-seccion">
      <div>
        <p class="texto-superior">Sección</p>
        <h2 id="titulo-detalles-seccion">{{ seccion.etiqueta }}</h2>
      </div>
      <strong>{{ seccion.pasillo }}</strong>
    </div>

    <div v-if="productoSeleccionado" class="producto-seleccionado">
      <div>
        <p class="texto-superior">Producto seleccionado</p>
        <h3>{{ productoSeleccionado.nombre }}</h3>
        <span>{{ productoSeleccionado.marca }}</span>
      </div>
      <dl>
        <div>
          <dt>Ubicación</dt>
          <dd>{{ productoSeleccionado.pasillo }} · {{ productoSeleccionado.estanteria }}</dd>
        </div>
        <div>
          <dt>Disponibilidad</dt>
          <dd>
            <em :class="['etiqueta-estado', productoSeleccionado.disponibilidad]">
              {{ etiquetaEstado[productoSeleccionado.disponibilidad] }}
            </em>
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="hayPistaRuta" class="pista-ruta" aria-label="Ruta rápida hasta el producto">
      <p class="texto-superior">Ruta rápida</p>
      <div>
        <span>Desde {{ seccionActual.etiqueta }}</span>
        <strong>{{ seccion.pasillo }}</strong>
      </div>
      <small>{{ productoSeleccionado.pasillo }} · {{ productoSeleccionado.estanteria }}</small>
    </div>

    <div class="bloque-detalle">
      <h3>Categorías</h3>
      <ul class="lista-etiquetas">
        <li v-for="categoria in seccion.categorias" :key="categoria">{{ categoria }}</li>
      </ul>
    </div>

    <div class="bloque-detalle">
      <h3>Productos destacados</h3>
      <ul class="lista-productos">
        <li v-for="producto in seccion.productosDestacados" :key="producto">{{ producto }}</li>
      </ul>
    </div>
  </section>
</template>
