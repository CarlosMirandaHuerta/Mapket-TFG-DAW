# Rúbrica de backend

Esta guía resume cómo Mapket cubre los puntos de backend de la rúbrica y qué partes quedan previstas para siguientes fases.

## Rutas

Mapket usa Vue Router con rutas principales para cliente y administración:

- `/`
- `/s/:codigoTienda`
- `/admin`
- `/admin/login`
- `/admin/setup-password`
- `/admin/reset-password`
- `/admin/secciones`
- `/admin/actividad`
- `/admin/empleados`
- `/:rutaNoEncontrada(.*)*`

La ruta comodín muestra una página 404 propia.

## Formularios

Formularios actuales:

- Login de empleado con Supabase Auth.
- Edición de inventario y ubicación de producto.
- Alta de productos desde el panel de inventario.
- Generación y copia de enlaces QR.
- Invitación de empleados por email desde el panel.

Los formularios muestran mensajes de éxito o error cuando corresponde.

## CRUD y base de datos

La app se conecta a Supabase y trabaja con estas tablas:

- `tiendas`
- `secciones`
- `categorias`
- `productos`
- `ubicaciones_productos`
- `inventario`
- `empleados`
- `registros_actividad`

Estado actual:

- Lectura de tienda, secciones, productos, ubicaciones y stock.
- Actualización de ubicación, cantidad y estado.
- Creación de producto, categoría, ubicación e inventario mediante Edge Function.
- Registro de actividad en `registros_actividad`.
- Alta segura de empleados mediante Edge Function.
- Eliminación segura de empleados mediante Edge Function.
- Lectura de empleados de la tienda desde el panel de administración.
- Eliminación de productos, ubicación e inventario mediante Edge Function.
- Actualización de ubicación, pasillo, estantería, cantidad y estado de productos existentes.
- Registro de cada edición de inventario en `registros_actividad`.

## Registro, login y administración

El login se realiza con Supabase Auth. Las rutas de administración no solo verifican sesión, también comprueban que el usuario exista en `empleados`.

La función `invitar-empleado` permite registrar empleados desde backend usando Supabase Edge Functions y la API Admin de Auth.

La función `completar-alta-empleado` termina el alta del empleado cuando acepta la invitación y crea su contraseña.

## Emails automáticos

La función `invitar-empleado` usa Supabase Auth para enviar emails automáticos de invitación a nuevos empleados.

## Paquetes

Las dependencias del frontend están definidas en `package.json`.

La Edge Function usa `@supabase/supabase-js@2` desde el runtime de Supabase:

```js
import { createClient } from 'npm:@supabase/supabase-js@2'
```


## Backend y rutas protegidas

El backend del proyecto se apoya en Supabase. Aunque la interfaz está desarrollada con Vue, las acciones importantes no se resuelven únicamente desde el navegador, sino que pasan por Supabase Auth, la base de datos PostgreSQL y las Edge Functions.

Las Edge Functions funcionan como rutas de backend. Cada función recibe una petición desde la aplicación, valida la sesión del usuario y comprueba sus permisos antes de modificar la base de datos. Esto permite separar las acciones públicas, como consultar productos o ver el mapa, de las acciones privadas del panel interno.

En Mapket, las operaciones de administración están protegidas. Por ejemplo, crear productos, eliminar productos, invitar empleados o eliminar empleados requiere que el usuario haya iniciado sesión y tenga el rol adecuado dentro de la tienda.

La base de datos también usa Row Level Security para reforzar la seguridad. Las lecturas necesarias para el mapa público están permitidas, pero las escrituras y acciones internas están limitadas a usuarios autenticados y empleados autorizados.

Las contraseñas no se guardan manualmente en las tablas propias de Mapket. La autenticación se gestiona mediante Supabase Auth, que se encarga del almacenamiento seguro de las credenciales.
