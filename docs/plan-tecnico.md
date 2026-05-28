# Plan técnico

## Arquitectura inicial

La primera versión puede ser una aplicación Vue con datos mock para validar la experiencia. Después se conectará a Supabase para almacenar productos, ubicaciones, stock y usuarios internos.

Componentes principales:

- Vue 3 + Vite + JavaScript.
- Vue Router para separar vista cliente y vista empleado.
- Pinia si el estado compartido empieza a crecer.
- Supabase como base de datos PostgreSQL y autenticación.
- SVG interactivo para representar el mapa del supermercado.

## Rutas previstas

- `/`: redirección o selección de tienda demo.
- `/s/:codigoTienda`: vista cliente de una tienda.
- `/s/:codigoTienda?from=:codigoSeccion`: vista cliente abierta desde un QR de sección.
- `/admin`: entrada al panel interno.
- `/admin/productos`: gestión de productos, ubicación y stock.
- `/admin/secciones`: gestión de secciones y códigos QR.
- `/admin/tiendas`: gestión de tiendas, en fases posteriores.

## Modelo de datos previsto

### `empresas`

Empresas o cadenas de supermercados.

- `id`
- `nombre`
- `creado_en`

### `tiendas`

Tiendas concretas.

- `id`
- `empresa_id`
- `nombre`
- `codigo`
- `direccion`
- `creado_en`

### `secciones`

Zonas visibles del mapa.

- `id`
- `tienda_id`
- `nombre`
- `codigo`
- `color`
- `map_shape`
- `label_x`
- `label_y`
- `creado_en`

`map_shape` puede ser JSON para guardar una forma SVG o una referencia a coordenadas del layout.

### `categorias`

Agrupaciones de productos.

- `id`
- `nombre`
- `codigo`
- `creado_en`

### `productos`

Catálogo de productos.

- `id`
- `categoria_id`
- `nombre`
- `codigo`
- `marca`
- `codigo_barras`
- `alias_busqueda`
- `url_imagen`
- `creado_en`
- `actualizado_en`

### `ubicaciones_productos`

Ubicación de un producto dentro de una tienda.

- `id`
- `tienda_id`
- `producto_id`
- `seccion_id`
- `pasillo`
- `estanteria`
- `nota_visible`
- `punto_mapa_x`
- `punto_mapa_y`
- `actualizado_en`

### `inventario`

Disponibilidad del producto en una tienda.

- `id`
- `tienda_id`
- `producto_id`
- `cantidad`
- `estado`
- `actualizado_en`

Estados iniciales:

- `disponible`
- `pocas_unidades`
- `agotado`

### `empleados`

Usuarios internos vinculados a una tienda.

- `id`
- `usuario_auth_id`
- `tienda_id`
- `rol`
- `nombre`
- `creado_en`

Roles iniciales:

- `empleado`
- `encargado`
- `admin`

### `registros_actividad`

Historial de cambios relevantes.

- `id`
- `tienda_id`
- `empleado_id`
- `tipo_entidad`
- `entidad_id`
- `accion`
- `datos_antes`
- `datos_despues`
- `creado_en`

## QR por sección

Cada QR debe abrir una URL con tienda y sección de origen.

Ejemplo:

```text
https://mapket.example/s/tienda-centro?from=lacteos
```

La app usará:

- `codigoTienda` para cargar el supermercado correcto.
- `from` para marcar la posición actual del cliente.

## Búsqueda

La búsqueda debe funcionar por:

- Nombre de producto.
- Marca.
- Categoría.
- Alias o sinónimos.
- Código de barras en fases posteriores.

Para el MVP, bastará con búsqueda en cliente sobre datos demo. Con Supabase, se puede empezar con filtros simples y evolucionar a búsqueda de texto en PostgreSQL.

## Seguridad y permisos

Vista cliente:

- Lectura pública limitada a productos, secciones, ubicaciones y disponibilidad visible.
- Sin permisos de escritura.

Vista empleado:

- Login obligatorio.
- Escritura permitida solo en la tienda asignada.
- Historial de cambios para trazabilidad.

Vista administrador:

- Gestión de tiendas, empleados, mapas y configuración.

## Decisiones pendientes

- Diseño exacto del mapa demo.
- Si el mapa se guarda como SVG estático, JSON editable o una mezcla.
- Si el primer panel interno será parte de la misma app o una zona separada dentro del mismo frontend.
- Nivel de precisión inicial de ubicación: sección, pasillo, estantería o coordenada exacta.
