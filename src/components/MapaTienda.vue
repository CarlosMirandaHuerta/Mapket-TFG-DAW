<script setup>
defineProps({
  secciones: {
    type: Array,
    required: true,
  },
  codigoSeleccionado: {
    type: String,
    required: true,
  },
  codigoActual: {
    type: String,
    required: true,
  },
})

defineEmits(['seleccionar'])
</script>

<template>
  <section class="mapa-tienda" aria-labelledby="mapa-tienda-title">
    <h2 id="mapa-tienda-title" class="titulo-mapa">Mapa interactivo</h2>

    <div class="leyenda-mapa" aria-hidden="true">
      <span><i class="punto-leyenda esta-seleccionado"></i>Sección seleccionada</span>
    </div>

    <div class="plano-tienda">
      <button
        v-for="seccion in secciones"
        :key="seccion.codigo"
        class="zona-tienda"
        :class="{
          'esta-actual': seccion.codigo === codigoActual,
          'esta-seleccionado': seccion.codigo === codigoSeleccionado,
        }"
        :style="{ '--seccion-color': seccion.color, gridArea: seccion.zona }"
        type="button"
        @click="$emit('seleccionar', seccion.codigo)"
      >
        <span class="titulo-zona">{{ seccion.etiqueta }}</span>
        <span class="pasillo-zona">{{ seccion.pasillo }}</span>
        <span v-if="seccion.codigo === codigoActual" class="etiqueta-zona">Estás aquí</span>
        <span
          v-else-if="seccion.codigo === codigoSeleccionado && codigoSeleccionado !== codigoActual"
          class="etiqueta-zona es-destino"
        >
          Destino
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.titulo-mapa {
  margin: 0 0 8px;
  color: #17211c;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1.1;
}

@media (max-width: 520px) {
  .titulo-mapa {
    font-size: 0.98rem;
  }
}
</style>
