<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="pagina-no-encontrada">
    <section class="panel-no-encontrado" aria-labelledby="not-found-title">
      <p class="texto-superior">Mapket</p>
      <h1 id="not-found-title">Página no encontrada</h1>
      <p>
        La ruta que intentas abrir no existe o ya no está disponible.
      </p>

      <div class="acciones-no-encontrado">
        <RouterLink class="boton-admin" to="/s/tienda-demo?from=entrada">
          Volver al mapa
        </RouterLink>
        <RouterLink class="enlace-volver" to="/admin">
          Panel de equipo
        </RouterLink>
      </div>
    </section>
  </main>
</template>
