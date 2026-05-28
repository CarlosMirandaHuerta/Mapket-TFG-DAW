# Supabase

Estos archivos preparan la base de datos real de Mapket.

## Archivos

- `base_datos_mapket.sql`: archivo SQL para crear la base de datos demo del prototipo, con tablas, relaciones, restricciones, políticas de Row Level Security y datos iniciales.
- `functions/invitar-empleado/index.js`: función backend para invitar empleados sin exponer claves privadas.
- `functions/completar-alta-empleado/index.js`: función backend para crear el empleado cuando acepta la invitación y crea su contraseña.
- `functions/crear-producto/index.js`: función backend para crear productos, ubicación e inventario.
- `functions/eliminar-producto/index.js`: función backend para eliminar productos del inventario y del mapa.
- `functions/eliminar-empleado/index.js`: función backend para eliminar empleados y limpiar invitaciones pendientes.
- `config.toml`: configuración de funciones y del archivo SQL definitivo.

## Proceso de creación

1. Crear un proyecto en Supabase.
2. Abrir el SQL Editor.
3. Ejecutar el contenido de `base_datos_mapket.sql`.
4. Copiar `.env.example` a `.env`.
5. Rellenar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
6. Desplegar las funciones necesarias con Supabase CLI (desde la terminal).

La app mantiene datos demo para desarrollo, pero cuando esas variables están configuradas lee y guarda datos en Supabase.

`base_datos_mapket.sql` representa la base inicial del prototipo. No es una copia exacta de la base real si después se han creado, editado o eliminado productos desde la aplicación desplegada.

El modelo de tablas, relaciones y cardinalidades está documentado en `docs/base-datos.md`.

Si la base de datos ya está creada y funcionando, no hace falta ejecutar de nuevo `base_datos_mapket.sql`. Este archivo sirve como referencia limpia para crear la base demo desde cero.

## Variables de entorno

Las variables se obtienen en Supabase, dentro de Project Settings, API:

```text
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=clave-publica-anon
```

En producción estas variables se configuran en Vercel. Los usuarios finales no las ven y no tienen que configurar nada.

## Usuario empleado (ENCARGADO)

Este proceso manual sirve para crear el PRIMER encargado o administrador de la tienda. Los empleados normales se pueden invitar después desde la propia aplicación.

1. Crear un usuario en Supabase Auth.
2. Copiar su `auth.users.id`.
3. Insertar un registro en `public.empleados` con ese `usuario_auth_id`, el `tienda_id` de la tienda y el rol `encargado` o `admin`.

Ejemplo:

```sql
insert into public.empleados (usuario_auth_id, tienda_id, rol, nombre)
values (
  'uuid-del-usuario-auth',
  (select id from public.tiendas where codigo = 'tienda-demo'),
  'encargado',
  'Empleado Demo'
);
```

Con esto, el encargado podrá entrar en `/admin` con su email y contraseña, y desde la app podrá invitar a otros empleados.

## Alta segura de empleados

La función `invitar-empleado` permite invitar empleados desde backend:

- exige sesión de Supabase
- comprueba que el usuario que invita existe en `empleados`
- solo permite invitar desde roles autorizados
- usa la clave privada dentro de Supabase Edge Functions, nunca en Vue
- envía el email automático de invitación de Supabase Auth
- no crea el registro en `empleados` hasta que el empleado acepta el email y crea su contraseña

Reglas actuales:

- `encargado`: puede invitar empleados con rol `empleado`
- `admin`: puede invitar empleados con rol `empleado`, `encargado` o `admin`

Despliegue con Supabase CLI (desde la terminal):

```bash
supabase functions deploy invitar-empleado
supabase functions deploy completar-alta-empleado
supabase functions deploy crear-producto
supabase functions deploy eliminar-producto
supabase functions deploy eliminar-empleado
```

Las funciones usan claves secretas que Supabase expone por defecto en Edge Functions:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

La `SUPABASE_SERVICE_ROLE_KEY` solo se usa dentro de la función. No debe añadirse al frontend ni a Vercel.

Configuración de URLs en Supabase Auth:

- Site URL: `https://mapket-web.vercel.app`
- Redirect URL permitida: `https://mapket-web.vercel.app/admin/setup-password`
- Redirect URL permitida: `https://mapket-web.vercel.app/admin/reset-password`
- plantilla `Invite user`: usar `{{ .ConfirmationURL }}` o una URL construida con `{{ .RedirectTo }}`, no una URL fija con `localhost`

Si una invitación se envía desde desarrollo local, la función fuerza la URL pública anterior para que el empleado pueda abrir el enlace desde cualquier dispositivo.

En el uso normal de la aplicación, el encargado invita al empleado desde la sección de equipo. La app llama internamente a `invitar-empleado`.

Cuando el empleado acepta el email de Supabase, Mapket lo lleva a `/admin/setup-password`. Al crear la contraseña, Mapket llama a `completar-alta-empleado`. Esa función revisa la invitación guardada en `app_metadata` y crea el registro en `empleados`.

## Alta segura de productos

La función `crear-producto` permite crear productos desde el panel de administración:

- exige sesión de Supabase
- comprueba que el usuario existe en `empleados`
- limita el alta a la tienda del empleado actual
- crea o reutiliza la categoría a partir de la sección seleccionada
- crea o actualiza el producto
- guarda ubicación en `ubicaciones_productos`
- guarda cantidad y estado en `inventario`
- genera búsquedas internas automáticamente
- registra la acción en `registros_actividad`

En el uso normal de la aplicación, el empleado crea productos desde el formulario de alta rápida del panel interno. La app llama internamente a `crear-producto`.

## Eliminación segura de productos

La función `eliminar-producto` permite eliminar productos desde el panel de inventario:

- exige sesión de Supabase
- comprueba que el usuario actual existe en `empleados`
- solo permite borrar productos a roles `encargado` o `admin`
- limita el borrado a la tienda del empleado actual
- elimina el inventario y la ubicación del producto
- elimina la ficha global del producto si ya no se usa en ninguna tienda
- registra la acción en `registros_actividad`

En el uso normal de la aplicación, el encargado o administrador elimina productos desde el panel de inventario. La app llama internamente a `eliminar-producto`.

## Eliminación segura de empleados

La función `eliminar-empleado` permite eliminar empleados desde el panel de administración:

- exige sesión de Supabase
- comprueba que el usuario actual existe en `empleados`
- impide que un usuario se elimine a sí mismo
- permite que un `encargado` elimine empleados con rol `empleado`
- permite que un `admin` elimine empleados, encargados y administradores
- impide eliminar el último administrador de la tienda
- elimina el usuario de Supabase Auth cuando es posible
- registra la acción en `registros_actividad`

En el uso normal de la aplicación, el encargado o administrador elimina empleados desde la sección de equipo. La app llama internamente a `eliminar-empleado`.

## Recuperación de contraseña

La ruta `/admin/reset-password` usa el flujo de Supabase Auth:

- desde `/admin/login`, el empleado puede pedir un email de recuperación
- Supabase envía el enlace automático al correo del empleado
- el enlace redirige a `/admin/reset-password`
- Mapket muestra el formulario de nueva contraseña cuando Supabase crea la sesión de recuperación
- al actualizar la contraseña, el empleado entra al panel si sigue dado de alta en `empleados`

La URL `https://mapket-web.vercel.app/admin/reset-password` debe estar añadida como Redirect URL permitida en Supabase Auth.


## Edición de ubicación e inventario

Los empleados pueden editar productos existentes desde el panel interno de Mapket.

Esta edición permite actualizar:

- sección del producto
- pasillo
- estantería
- cantidad disponible
- estado del producto: disponible, pocas unidades o agotado

Estos cambios se guardan en las tablas `ubicaciones_productos` e `inventario`. La aplicación limpia los datos introducidos en el formulario antes de enviarlos a Supabase.

La base de datos usa políticas RLS para que un empleado solo pueda actualizar productos de su propia tienda. Además, cada modificación queda registrada en `registros_actividad`, permitiendo consultar qué cambios se han hecho sobre el inventario.


## Backend con Supabase

El backend de Mapket está formado por tres partes principales:

- Base de datos PostgreSQL, donde se guardan empresas, tiendas, secciones, productos, ubicaciones, inventario, empleados y registros de actividad.
- Supabase Auth, que gestiona el login, las sesiones y las contraseñas de los usuarios.
- Edge Functions, que actúan como rutas de backend para las operaciones protegidas.

Las Edge Functions son funciones que se ejecutan en Supabase y reciben peticiones desde la aplicación. En Mapket se usan para las acciones que no deben depender únicamente del frontend, como invitar empleados, completar el alta de un empleado, crear productos, eliminar productos o eliminar empleados.

El flujo habitual es el siguiente:

1. El usuario inicia sesión desde la aplicación.
2. Supabase Auth devuelve una sesión válida.
3. Cuando el usuario realiza una acción protegida, la aplicación llama a una Edge Function.
4. La función comprueba la sesión del usuario.
5. La función revisa si el usuario existe como empleado y si tiene permisos suficientes.
6. Si todo es correcto, la función realiza la operación en la base de datos.
7. La aplicación muestra un mensaje de éxito o error según el resultado.

Además, la base de datos tiene Row Level Security activado. Esto significa que las tablas tienen políticas de seguridad que controlan qué datos puede leer o modificar cada usuario.
