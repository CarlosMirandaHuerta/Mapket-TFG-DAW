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
  <section class="mapa-tienda" aria-label="Mapa interactivo del supermercado">
    <div class="leyenda-mapa" aria-hidden="true">
      <span><i class="punto-leyenda esta-actual"></i>Estás aquí</span>
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
