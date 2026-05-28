# Mapket

Mapket es una web mobile-first que ayuda a clientes y empleados de supermercado a localizar productos dentro de una tienda.

La idea principal es colocar códigos QR en distintas secciones del supermercado. Al escanear uno, el cliente abre la web desde su móvil, la app sabe desde qué sección empieza, y puede buscar un producto para verlo resaltado en el mapa.

## Objetivo

Crear una experiencia sencilla para que cualquier cliente pueda encontrar rápidamente productos dentro del supermercado, y una herramienta interna para que los empleados puedan mantener actualizadas ubicaciones, disponibilidad y cantidades.

## Experiencias principales

- Cliente: escanea un QR, busca productos, ve su ubicación en el mapa y consulta si están disponibles.
- Empleado: inicia sesión, edita ubicaciones, actualiza stock, marca productos agotados o pendientes de reposición.
- Administrador: gestiona tiendas, secciones, mapas, productos, categorías y empleados.

## Stack

- Frontend: Vue 3, Vite y JavaScript.
- Rutas: Vue Router.
- Base de datos: PostgreSQL mediante Supabase.
- Autenticación: Supabase Auth para empleados y administradores.
- Mapa: layout interactivo con secciones clicables.
- QR: enlaces por tienda y sección, por ejemplo `/s/tienda-centro?from=lacteos`.

## Estado del proyecto

MVP funcional en Vue. La app incluye mapa de tienda, búsqueda de productos, contexto por QR, panel de empleados, edición de stock y ubicación, historial de actividad y despliegue web con Supabase.

## Demo desplegada

La app está publicada en:

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

Las credenciales de empleados se gestionan en Supabase Auth y no se guardan en el repositorio.

## Uso en local

```bash
npm install
npm run dev
```

La app local se abre en:

```text
http://127.0.0.1:5173/
```

Ruta de ejemplo para simular un QR colocado en la entrada:

```text
http://127.0.0.1:5173/s/tienda-demo?from=entrada
```

## Base de datos real

Mapket funciona en modo demo si no hay credenciales configuradas. Para usar datos reales, el propietario del proyecto debe crear un proyecto en Supabase, ejecutar los SQL de `supabase/` y configurar estas variables en `.env` o en la plataforma de despliegue:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Los clientes y empleados no configuran nada: entran directamente desde la URL pública desplegada.

Más detalle en [docs/despliegue.md](docs/despliegue.md), [docs/base-datos.md](docs/base-datos.md), [docs/seguridad.md](docs/seguridad.md) y [supabase/README.md](supabase/README.md).


## Funcionamiento general del backend

Mapket utiliza Supabase como backend principal. La aplicación web está hecha con Vue y se despliega en Vercel, mientras que Supabase se encarga de la base de datos, la autenticación de usuarios y las operaciones protegidas del panel interno.

El frontend consulta directamente los datos públicos necesarios para que el cliente pueda ver el mapa del supermercado, las secciones y los productos. Para las acciones internas, como crear productos, eliminar productos o gestionar empleados, la aplicación utiliza Edge Functions de Supabase.

Una Edge Function es una función de backend que se ejecuta en Supabase. Funciona como una ruta de servidor: la aplicación le envía una petición, la función valida quién está haciendo la acción, comprueba si tiene permisos y después realiza la operación correspondiente en la base de datos.

De esta forma, Mapket no depende solo del código del navegador para proteger acciones importantes. Las operaciones sensibles se validan en el backend antes de modificar la base de datos.

La parte de backend y su relación con la rúbrica se resume en [docs/backend.md](docs/backend.md).

## Despliegue

El proyecto está preparado para desplegarse como aplicación estática en Vercel o Netlify.

Comando de build:

```bash
npm run build
```

Directorio de salida:

```text
dist
```

La configuración de rutas está incluida en `vercel.json` y `public/_redirects` para que funcionen rutas como `/admin` o `/s/tienda-demo?from=entrada` al entrar directamente desde el navegador.

## Flujo de trabajo en Git

- `main`: versión estable.
- Ramas con nombres descriptivos, una por funcionalidad o bloque de trabajo.
- Commits pequeños, descriptivos y fáciles de revisar.
