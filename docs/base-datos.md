# Modelo de base de datos

Este documento resume el diseño actual de la base de datos de Mapket. Sirve como referencia para revisar relaciones, cardinalidades y restricciones antes de redactar la memoria final.

## Objetivo del modelo

La base de datos separa claramente cuatro áreas:

- estructura de negocio: empresas y tiendas
- mapa de supermercado: secciones de cada tienda
- catálogo y disponibilidad: categorías, productos, ubicaciones e inventario
- administración interna: empleados e historial de actividad

El diseño permite que una misma app soporte varias tiendas sin mezclar datos entre ellas.

## Diagrama ER

```mermaid
erDiagram
  empresas ||--o{ tiendas : "tiene"
  tiendas ||--o{ secciones : "divide"
  tiendas ||--o{ empleados : "asigna"
  auth_users ||--o| empleados : "autentica"
  categorias ||--o{ productos : "clasifica"
  tiendas ||--o{ ubicaciones_productos : "ubica"
  secciones ||--o{ ubicaciones_productos : "contiene"
  productos ||--o{ ubicaciones_productos : "aparece en"
  ubicaciones_productos ||--o| inventario : "tiene stock"
  tiendas ||--o{ registros_actividad : "registra"
  empleados ||--o{ registros_actividad : "realiza"

  empresas {
    uuid id PK
    text nombre
    text codigo UK
    timestamptz creado_en
  }

  tiendas {
    uuid id PK
    uuid empresa_id FK
    text nombre
    text codigo UK
    text direccion
    timestamptz creado_en
  }

  secciones {
    uuid id PK
    uuid tienda_id FK
    text nombre
    text codigo
    text color
    text zona_mapa
    text etiqueta_pasillo
    integer orden
    timestamptz creado_en
  }

  categorias {
    uuid id PK
    text nombre
    text codigo UK
    timestamptz creado_en
  }

  productos {
    uuid id PK
    uuid categoria_id FK
    text nombre
    text codigo UK
    text marca
    text codigo_barras UK
    text[] alias_busqueda
    text url_imagen
    timestamptz creado_en
    timestamptz actualizado_en
  }

  ubicaciones_productos {
    uuid id PK
    uuid tienda_id FK
    uuid producto_id FK
    uuid seccion_id FK
    text pasillo
    text estanteria
    text nota_visible
    numeric punto_mapa_x
    numeric punto_mapa_y
    timestamptz actualizado_en
  }

  inventario {
    uuid id PK
    uuid tienda_id FK
    uuid producto_id FK
    integer cantidad
    estado_inventario estado
    timestamptz actualizado_en
  }

  empleados {
    uuid id PK
    uuid usuario_auth_id FK
    uuid tienda_id FK
    rol_empleado rol
    text nombre
    timestamptz creado_en
  }

  auth_users {
    uuid id PK
  }

  registros_actividad {
    uuid id PK
    uuid tienda_id FK
    uuid empleado_id FK
    text tipo_entidad
    uuid entidad_id
    text accion
    jsonb datos_antes
    jsonb datos_despues
    timestamptz creado_en
  }
```

## Cardinalidades

- `empresas` 1:N `tiendas`: una empresa puede tener muchas tiendas; cada tienda pertenece a una empresa.
- `tiendas` 1:N `secciones`: una tienda tiene varias secciones; cada sección pertenece a una tienda.
- `tiendas` 1:N `empleados`: una tienda tiene varios empleados; cada empleado pertenece a una tienda.
- `categorias` 1:N `productos`: una categoría puede clasificar varios productos; cada producto tiene una categoría.
- `productos` N:M `tiendas` mediante `ubicaciones_productos`: un producto puede estar en varias tiendas y cada tienda puede tener muchos productos.
- `secciones` 1:N `ubicaciones_productos`: una sección puede contener muchos productos ubicados; cada ubicación pertenece a una sección.
- `ubicaciones_productos` 1:0..1 `inventario`: una ubicación de producto puede tener un registro de inventario; el inventario no puede existir sin ubicación.
- `empleados` 1:N `registros_actividad`: un empleado puede generar muchos registros; el registro conserva la actividad aunque el empleado sea eliminado.
- `tiendas` 1:N `registros_actividad`: cada actividad queda vinculada a la tienda donde ocurrió.
- `auth.users` 1:0..1 `empleados`: un usuario de Supabase Auth puede estar asociado como empleado de una tienda.

## Restricciones principales

- Todas las tablas principales usan `uuid` como clave primaria.
- `empresas.codigo`, `tiendas.codigo`, `categorias.codigo` y `productos.codigo` son únicos para evitar rutas o búsquedas ambiguas.
- `secciones` impide repetir una misma sección dentro de una tienda con `unique (tienda_id, codigo)`.
- `ubicaciones_productos` impide duplicar un producto dentro de la misma tienda con `unique (tienda_id, producto_id)`.
- `inventario` usa `unique (tienda_id, producto_id)` y una clave foránea compuesta hacia `ubicaciones_productos`.
- `inventario.cantidad` no puede ser negativa.
- `ubicaciones_productos.seccion_id` debe pertenecer a la misma tienda indicada en `ubicaciones_productos.tienda_id`.
- `punto_mapa_x` y `punto_mapa_y` están preparados para una mejora futura con posición exacta dentro del mapa. Actualmente la app localiza productos por sección, pasillo y estantería. Si estos campos se usan más adelante, solo aceptarán valores entre 0 y 100.
- `registros_actividad.tipo_entidad` queda limitado a entidades conocidas del sistema.

## Borrados y consistencia

- Al borrar una empresa, se eliminan sus tiendas por `on delete cascade`.
- Al borrar una tienda, se eliminan secciones, ubicaciones, inventario, empleados y actividad de esa tienda.
- Al borrar un producto, se eliminan sus ubicaciones e inventario asociado.
- Al borrar un empleado, sus registros de actividad conservan el histórico con `empleado_id` a `null`.
- Las secciones usan `on delete restrict` en ubicaciones para evitar eliminar una sección que aún contiene productos.

## Índices

- `productos_nombre_idx`: búsqueda de texto en español por nombre de producto.
- `productos_alias_idx`: búsqueda por alias y sinónimos.
- `ubicaciones_productos_tienda_idx`: carga eficiente de productos por tienda y sección.
- `inventario_tienda_estado_idx`: filtros rápidos por tienda y estado de stock.
- `registros_actividad_tienda_creado_idx`: historial ordenado por tienda y fecha.

## Seguridad

La base de datos usa Row Level Security en todas las tablas públicas. Las lecturas necesarias para clientes son públicas, pero las escrituras del panel interno se hacen con sesión de empleado o mediante Edge Functions.

Las funciones auxiliares `tienda_empleado_actual_id()` y `rol_empleado_actual()` centralizan la comprobación de tienda y rol del usuario autenticado.

## Decisiones de diseño

- `ubicaciones_productos` e `inventario` están separados para no mezclar ubicación física y cantidad disponible.
- `registros_actividad` usa `tipo_entidad`, `entidad_id`, `datos_antes` y `datos_despues` porque registra acciones de distintas entidades sin perder histórico.
- `productos` funciona como catálogo global, mientras que `ubicaciones_productos` e `inventario` representan la situación concreta en cada tienda.
- `secciones.zona_mapa` guarda la referencia visual del mapa para conectar la base de datos con el layout interactivo de Vue.
