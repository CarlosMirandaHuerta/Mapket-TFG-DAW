# Plan de producto

## Visión

Mapket será una web para supermercados que permite localizar productos dentro de una tienda usando el móvil. El cliente escanea un código QR colocado en una sección, busca lo que necesita y ve en el mapa dónde está el producto.

El mismo sistema también debe servir al equipo del supermercado para actualizar ubicaciones, cantidades y disponibilidad. Así la información que ve el cliente se mantiene viva y los reponedores tienen una herramienta práctica para trabajar.

## Usuarios

### Cliente

Persona que está comprando y quiere encontrar rápidamente un producto sin preguntar a un empleado.

Necesita:

- Buscar productos por nombre, marca o categoría.
- Ver una ubicación clara en el mapa.
- Saber si el producto está disponible, agotado o con pocas unidades.
- Entender dónde está ahora mismo según el QR escaneado.

### Empleado o reponedor

Trabajador que necesita mantener productos y stock actualizados desde móvil, tablet u ordenador.

Necesita:

- Buscar productos rápidamente.
- Cambiar la sección, pasillo o estantería de un producto.
- Marcar productos como disponibles, con pocas unidades o agotados.
- Ver productos que necesitan reposición.
- Trabajar con una interfaz muy sencilla y rápida.

### Administrador

Responsable de tienda o empresa que configura el sistema.

Necesita:

- Crear y editar supermercados.
- Configurar mapas y secciones.
- Gestionar empleados.
- Revisar cambios y estadísticas de uso.

## Flujo del cliente

1. El cliente escanea un QR en una sección del supermercado.
2. La web se abre con la tienda y sección de origen ya identificadas.
3. El mapa muestra "estás aquí" en la sección escaneada.
4. El cliente busca un producto, por ejemplo "yogures".
5. La app muestra resultados relevantes.
6. Al seleccionar un resultado, el mapa resalta la sección donde está el producto.
7. La ficha del producto muestra sección, pasillo, estantería y disponibilidad.

## Flujo del empleado

1. El empleado inicia sesión.
2. Entra en el panel de productos.
3. Busca un producto o filtra por sección.
4. Edita ubicación, cantidad o estado.
5. Guarda el cambio.
6. La vista del cliente queda actualizada.
7. El sistema registra el cambio en un historial.

## MVP del cliente

- Web responsive pensada primero para móvil.
- Mapa interactivo de una tienda demo.
- Secciones con colores y títulos claros.
- Buscador de productos.
- Filtros por categoría.
- Resaltado visual del producto en el mapa.
- Parámetro `from` en la URL para marcar la sección donde se escaneó el QR.
- Datos iniciales de ejemplo.

## MVP interno

El panel de empleado puede entrar después del MVP del cliente, pero el modelo de datos debe prepararse desde el principio.

Primer alcance del panel:

- Login de empleado.
- Lista y buscador de productos.
- Edición de ubicación.
- Edición de cantidad aproximada.
- Estado de stock: disponible, pocas unidades, agotado.
- Historial básico de cambios.

## Funciones futuras

- Ruta visual desde la sección actual hasta el producto.
- Soporte para varias tiendas.
- Generador de códigos QR por sección.
- Estadísticas de productos más buscados.
- Alertas para reposición.
- Modo PWA para usar la web como app instalable.
- Imágenes de productos.
- Búsqueda por sinónimos, marcas y códigos de barras.

## Principios de diseño

- Mobile-first.
- Interfaz clara, rápida y sin distracciones.
- Botones y áreas táctiles cómodas.
- Mapa legible incluso en pantallas pequeñas.
- Colores de sección consistentes.
- Menos texto explicativo, más acción directa.
- Panel de empleado simple, parecido a una herramienta diaria, no a un ERP pesado.
