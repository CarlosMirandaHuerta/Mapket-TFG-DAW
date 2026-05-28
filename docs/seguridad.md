# Seguridad

Esta guía resume cómo Mapket cubre la parte de seguridad de la rúbrica.

## Rutas protegidas

Las rutas de cliente son públicas porque están pensadas para que cualquier persona pueda escanear un QR y consultar el mapa de la tienda.

Las rutas internas de administración se protegen desde `src/router/index.js`:

- `/admin`, `/admin/secciones`, `/admin/actividad` y `/admin/empleados` requieren sesión válida de Supabase Auth.
- La sesión se comprueba con `getVerifiedSession`, que descarta sesiones caducadas o usuarios eliminados.
- Además de iniciar sesión, el usuario debe existir en la tabla `empleados`.
- `/admin/empleados` solo está disponible para roles con permisos de gestión de equipo.
- `/admin/setup-password` solo se usa durante el primer acceso de un empleado invitado.

Las Edge Functions también verifican permisos en backend. Antes de modificar la base de datos comprueban:

- cabecera `Authorization`;
- usuario válido en Supabase Auth;
- empleado registrado en `empleados`;
- tienda asociada al empleado;
- rol suficiente para acciones sensibles como invitar empleados o eliminar productos.

## Limpieza de formularios

La limpieza común está centralizada en `src/services/security.js`.

El helper elimina caracteres de control y caracteres con riesgo en texto mostrado en pantalla, normaliza espacios y limita la longitud de los campos. Se aplica en:

- login y recuperación de contraseña, normalizando emails;
- buscador de cliente y buscador interno;
- formulario de invitación de empleados;
- creación de productos;
- edición de ubicación de productos.

Las contraseñas no se limpian modificando caracteres, porque el usuario debe poder usar símbolos seguros. En su lugar, se validan por longitud mínima y se borran del estado del formulario después del envío.

## Prevención de SQL malicioso

La app no construye consultas SQL concatenando texto del usuario.

El frontend usa el cliente de Supabase con métodos como `select`, `eq`, `insert`, `update`, `upsert` y `delete`. Las Edge Functions usan el mismo cliente y validan los datos antes de llamar a la base de datos.

Las operaciones más delicadas se hacen en Edge Functions:

- `crear-producto`;
- `eliminar-producto`;
- `invitar-empleado`;
- `eliminar-empleado`;
- `completar-alta-empleado`.

De esta forma, aunque alguien intente llamar directamente a una función, la operación no se ejecuta sin sesión, empleado, tienda y permisos correctos.

## Prevención de JS malicioso

La interfaz no usa inserción dinámica de HTML como `v-html`, `innerHTML`, `insertAdjacentHTML`, `eval` o `new Function`.

Los textos de productos, empleados, secciones y mensajes se muestran con interpolación normal de Vue, que escapa el contenido en la vista. Además, los textos que entran desde formularios se limpian antes de guardarse o enviarse al backend.

## Contraseñas

Mapket no guarda contraseñas en sus tablas públicas. La tabla `empleados` solo guarda el identificador `usuario_auth_id` para relacionar cada empleado con Supabase Auth.

Las contraseñas se gestionan con Supabase Auth mediante:

- `signInWithPassword` para login;
- `updateUser` para crear o cambiar contraseña;
- `resetPasswordForEmail` para recuperación por email.

Según la documentación oficial de Supabase, Supabase Auth guarda hashes de contraseña con bcrypt y sal aleatoria. Técnicamente esto es hashing, no encriptación reversible, que es lo correcto para contraseñas.

Referencia oficial: https://supabase.com/docs/guides/auth/password-security
