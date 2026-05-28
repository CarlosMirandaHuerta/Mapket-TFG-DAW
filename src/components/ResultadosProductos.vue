<script setup>
defineProps({
  productos: {
    type: Array,
    required: true,
  },
  idProductoSeleccionado: {
    type: String,
    required: true,
  },
})

defineEmits(['seleccionar'])

const etiquetaEstado = {
  disponible: 'Disponible',
  pocas_unidades: 'Pocas unidades',
  agotado: 'Agotado',
}
</script>

<template>
  <section class="resultados-productos" aria-labelledby="resultados-productos-title">
    <div class="cabecera-resultados-productos">
      <h2 id="resultados-productos-title">Productos</h2>
      <span>{{ productos.length }} resultados</span>
    </div>

    <p v-if="productos.length === 0" class="sin-resultados">Sin resultados</p>

    <ul v-else class="lista-resultados">
      <li v-for="producto in productos" :key="producto.id">
        <button
          class="elemento-resultado"
          :class="{ 'esta-seleccionado': producto.id === idProductoSeleccionado }"
          type="button"
          @click="$emit('seleccionar', producto)"
        >
          <span>
            <strong>{{ producto.nombre }}</strong>
            <small>{{ producto.marca }} · {{ producto.categoria }}</small>
          </span>
          <em :class="['etiqueta-estado', producto.disponibilidad]">
            {{ etiquetaEstado[producto.disponibilidad] }}
          </em>
        </button>
      </li>
    </ul>
  </section>
</template>
