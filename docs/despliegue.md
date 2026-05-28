# Despliegue de Mapket

Esta guía explica cómo publicar Mapket como una web real. Los clientes y empleados no tienen que instalar ni configurar nada: solo entran a la URL pública.

## Objetivo

El funcionamiento final debe ser:

- Cliente: abre la URL o escanea un QR y usa el mapa desde el móvil.
- Empleado: entra en `/admin`, inicia sesión y gestiona productos.
- Propietario del proyecto: configura Supabase y la plataforma de despliegue una sola vez.

## URL de producción

La demo pública está desplegada en:

```text
https://mapket-web.vercel.app
```

Rutas principales:

```text
https://mapket-web.vercel.app/s/tienda-demo?from=entrada
https://mapket-web.vercel.app/admin
https://mapket-web.vercel.app/admin/secciones
https://mapket-web.vercel.app/admin/actividad
```

## Variables necesarias

Mapket necesita estas variables para conectarse a Supabase:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

En local se guardan en `.env`. En producción se configuran en Vercel, dentro de las variables de entorno del proyecto.

## Despliegue en Vercel

1. Crear un proyecto en Vercel conectado a este repositorio de GitHub.
2. Usar estos ajustes:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
3. Añadir las variables de Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Lanzar el despliegue.

`vercel.json` ya redirige todas las rutas a `index.html`, así que funcionan enlaces directos como `/admin` y `/s/tienda-demo?from=entrada`.


## Comprobaciones después de desplegar

Probar estas rutas en la URL pública:

```text
https://mapket-web.vercel.app/
https://mapket-web.vercel.app/s/tienda-demo?from=entrada
https://mapket-web.vercel.app/admin
https://mapket-web.vercel.app/admin/secciones
https://mapket-web.vercel.app/admin/actividad
```

También conviene comprobar:

- búsqueda de productos
- selección de secciones en el mapa
- generación de códigos QR
- inicio de sesión de empleado
- edición de cantidad, estado y ubicación
- historial de actividad
