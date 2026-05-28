-- Base de datos demo de Mapket.
-- Este archivo crea el esquema y los datos iniciales del prototipo.
-- No es una copia exacta de la base de datos real si después se han creado,
-- editado o eliminado productos desde la aplicación desplegada.

create extension if not exists pgcrypto;

do $$
begin
  create type public.estado_inventario as enum ('disponible', 'pocas_unidades', 'agotado');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rol_empleado as enum ('empleado', 'encargado', 'admin');
exception
  when duplicate_object then null;
end $$;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  creado_en timestamptz not null default now()
);

create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  codigo text not null,
  direccion text,
  creado_en timestamptz not null default now(),
  constraint tiendas_codigo_unique unique (codigo),
  unique (empresa_id, codigo)
);

create table public.secciones (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  nombre text not null,
  codigo text not null,
  color text not null,
  zona_mapa text not null,
  etiqueta_pasillo text not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  constraint secciones_id_tienda_id_unique unique (id, tienda_id),
  unique (tienda_id, codigo)
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  creado_en timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id),
  nombre text not null,
  codigo text not null unique,
  marca text,
  codigo_barras text unique,
  alias_busqueda text[] not null default '{}',
  url_imagen text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.ubicaciones_productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  seccion_id uuid not null references public.secciones(id) on delete restrict,
  pasillo text not null,
  estanteria text not null,
  nota_visible text,
  punto_mapa_x numeric(6, 2),
  punto_mapa_y numeric(6, 2),
  actualizado_en timestamptz not null default now(),
  constraint ubicaciones_productos_seccion_tienda_fk
    foreign key (seccion_id, tienda_id)
    references public.secciones(id, tienda_id)
    on delete restrict,
  constraint ubicaciones_productos_punto_mapa_x_rango
    check (punto_mapa_x is null or (punto_mapa_x >= 0 and punto_mapa_x <= 100)),
  constraint ubicaciones_productos_punto_mapa_y_rango
    check (punto_mapa_y is null or (punto_mapa_y >= 0 and punto_mapa_y <= 100)),
  unique (tienda_id, producto_id)
);

create table public.inventario (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  cantidad integer,
  estado public.estado_inventario not null default 'disponible',
  actualizado_en timestamptz not null default now(),
  unique (tienda_id, producto_id),
  constraint inventario_cantidad_no_negativa check (cantidad is null or cantidad >= 0),
  constraint inventario_ubicacion_fk
    foreign key (tienda_id, producto_id)
    references public.ubicaciones_productos(tienda_id, producto_id)
    on delete cascade
);

create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  usuario_auth_id uuid not null unique references auth.users(id) on delete cascade,
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  rol public.rol_empleado not null default 'empleado',
  nombre text not null,
  creado_en timestamptz not null default now()
);

create table public.registros_actividad (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  empleado_id uuid references public.empleados(id) on delete set null,
  tipo_entidad text not null,
  entidad_id uuid not null,
  accion text not null,
  datos_antes jsonb,
  datos_despues jsonb,
  creado_en timestamptz not null default now(),
  constraint registros_actividad_tipo_entidad_check
    check (tipo_entidad in ('tienda', 'seccion', 'categoria', 'producto', 'inventario', 'empleado', 'invitacion_empleado'))
);

create index productos_nombre_idx on public.productos using gin (to_tsvector('spanish', nombre));
create index productos_alias_idx on public.productos using gin (alias_busqueda);
create index ubicaciones_productos_tienda_idx on public.ubicaciones_productos (tienda_id, seccion_id);
create index inventario_tienda_estado_idx on public.inventario (tienda_id, estado);
create index registros_actividad_tienda_creado_idx on public.registros_actividad (tienda_id, creado_en desc);

create or replace function public.asignar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger productos_asignar_actualizado_en
before update on public.productos
for each row execute function public.asignar_actualizado_en();

create trigger ubicaciones_productos_asignar_actualizado_en
before update on public.ubicaciones_productos
for each row execute function public.asignar_actualizado_en();

create trigger inventario_asignar_actualizado_en
before update on public.inventario
for each row execute function public.asignar_actualizado_en();

create or replace function public.tienda_empleado_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tienda_id from public.empleados where usuario_auth_id = auth.uid() limit 1;
$$;

create or replace function public.rol_empleado_actual()
returns public.rol_empleado
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.empleados where usuario_auth_id = auth.uid() limit 1;
$$;

alter table public.empresas enable row level security;
alter table public.tiendas enable row level security;
alter table public.secciones enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.ubicaciones_productos enable row level security;
alter table public.inventario enable row level security;
alter table public.empleados enable row level security;
alter table public.registros_actividad enable row level security;

create policy "lectura publica empresas"
on public.empresas for select
using (true);

create policy "lectura publica tiendas"
on public.tiendas for select
using (true);

create policy "lectura publica secciones"
on public.secciones for select
using (true);

create policy "lectura publica categorias"
on public.categorias for select
using (true);

create policy "lectura publica productos"
on public.productos for select
using (true);

create policy "lectura publica ubicaciones productos"
on public.ubicaciones_productos for select
using (true);

create policy "lectura publica inventario"
on public.inventario for select
using (true);

create policy "empleados leen empleados misma tienda"
on public.empleados for select
to authenticated
using (tienda_id = public.tienda_empleado_actual_id());

create policy "empleados actualizan ubicaciones misma tienda"
on public.ubicaciones_productos for update
to authenticated
using (tienda_id = public.tienda_empleado_actual_id())
with check (tienda_id = public.tienda_empleado_actual_id());

create policy "empleados actualizan inventario misma tienda"
on public.inventario for update
to authenticated
using (tienda_id = public.tienda_empleado_actual_id())
with check (tienda_id = public.tienda_empleado_actual_id());

create policy "empleados insertan actividad misma tienda"
on public.registros_actividad for insert
to authenticated
with check (tienda_id = public.tienda_empleado_actual_id());

create policy "empleados leen actividad misma tienda"
on public.registros_actividad for select
to authenticated
using (tienda_id = public.tienda_empleado_actual_id());

insert into public.empresas (nombre, codigo)
values ('Mapket Demo', 'mapket-demo')
on conflict (codigo) do update set nombre = excluded.nombre;

insert into public.tiendas (empresa_id, nombre, codigo, direccion)
values (
  (select id from public.empresas where codigo = 'mapket-demo'),
  'Tienda Demo',
  'tienda-demo',
  'Calle Demo 1'
)
on conflict (empresa_id, codigo) do update set
  nombre = excluded.nombre,
  direccion = excluded.direccion;

insert into public.secciones (tienda_id, nombre, codigo, color, zona_mapa, etiqueta_pasillo, orden)
values
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Entrada', 'entrada', '#2f855a', 'entrance', 'Acceso principal', 10),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Frutas y verduras', 'frutas', '#f6ad55', 'produce', 'Pasillos 1 y 2', 20),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Panadería', 'panaderia', '#d69e2e', 'bakery', 'Pasillo 3', 30),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Lácteos', 'lacteos', '#63b3ed', 'dairy', 'Pasillo 4', 40),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Bebidas', 'bebidas', '#38b2ac', 'drinks', 'Pasillos 5 y 6', 50),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Congelados', 'congelados', '#7f9cf5', 'frozen', 'Pasillo 7', 60),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Limpieza', 'limpieza', '#9f7aea', 'cleaning', 'Pasillo 8', 70),
  ((select id from public.tiendas where codigo = 'tienda-demo'), 'Cajas', 'cajas', '#fc8181', 'checkout', 'Salida', 80)
on conflict (tienda_id, codigo) do update set
  nombre = excluded.nombre,
  color = excluded.color,
  zona_mapa = excluded.zona_mapa,
  etiqueta_pasillo = excluded.etiqueta_pasillo,
  orden = excluded.orden;

insert into public.categorias (nombre, codigo)
values
  ('Lácteos', 'lacteos'),
  ('Frutas y verduras', 'frutas-verduras'),
  ('Panadería', 'panaderia'),
  ('Bebidas', 'bebidas'),
  ('Congelados', 'congelados'),
  ('Limpieza', 'limpieza')
on conflict (codigo) do update set nombre = excluded.nombre;

insert into public.productos (categoria_id, nombre, codigo, marca, alias_busqueda)
values
  ((select id from public.categorias where codigo = 'lacteos'), 'Yogur natural', 'yogur-natural-hacendado', 'Hacendado', array['yogures', 'yogurt', 'postre']),
  ((select id from public.categorias where codigo = 'lacteos'), 'Leche entera', 'leche-entera-puleva', 'Puleva', array['leche', 'brick', 'entera']),
  ((select id from public.categorias where codigo = 'lacteos'), 'Queso fresco', 'queso-fresco-burgos', 'El Ventero', array['queso', 'burgos']),
  ((select id from public.categorias where codigo = 'frutas-verduras'), 'Plátano de Canarias', 'platano-canarias', 'Origen Canarias', array['plátanos', 'banana', 'fruta']),
  ((select id from public.categorias where codigo = 'frutas-verduras'), 'Tomate en rama', 'tomate-rama', 'Huerta Sur', array['tomates', 'verdura', 'ensalada']),
  ((select id from public.categorias where codigo = 'panaderia'), 'Barra de pan', 'barra-pan', 'Obrador', array['pan', 'baguette']),
  ((select id from public.categorias where codigo = 'panaderia'), 'Croissant de mantequilla', 'croissant-mantequilla', 'Obrador', array['bollería', 'croissants', 'dulce']),
  ((select id from public.categorias where codigo = 'bebidas'), 'Agua mineral 1,5 L', 'agua-mineral-15', 'Bezoya', array['agua', 'botella']),
  ((select id from public.categorias where codigo = 'bebidas'), 'Refresco de cola', 'refresco-cola', 'Coca-Cola', array['cocacola', 'cola', 'refresco']),
  ((select id from public.categorias where codigo = 'congelados'), 'Pizza margarita', 'pizza-margarita', 'Casa Tarradellas', array['pizza', 'congelado']),
  ((select id from public.categorias where codigo = 'congelados'), 'Helado de vainilla', 'helado-vainilla', 'Carte D''Or', array['helado', 'postre', 'vainilla']),
  ((select id from public.categorias where codigo = 'limpieza'), 'Detergente líquido', 'detergente-liquido', 'Ariel', array['detergente', 'lavadora', 'ropa']),
  ((select id from public.categorias where codigo = 'limpieza'), 'Papel higiénico', 'papel-higienico', 'Scottex', array['papel', 'baño', 'higiene'])
on conflict (codigo) do update set
  categoria_id = excluded.categoria_id,
  nombre = excluded.nombre,
  marca = excluded.marca,
  alias_busqueda = excluded.alias_busqueda;

insert into public.ubicaciones_productos (tienda_id, producto_id, seccion_id, pasillo, estanteria)
values
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'yogur-natural-hacendado'), (select id from public.secciones where codigo = 'lacteos' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 4', 'Estantería central'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'leche-entera-puleva'), (select id from public.secciones where codigo = 'lacteos' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 4', 'Módulo frío'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'queso-fresco-burgos'), (select id from public.secciones where codigo = 'lacteos' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 4', 'Frigorífico derecho'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'platano-canarias'), (select id from public.secciones where codigo = 'frutas' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 1', 'Mesa de fruta'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'tomate-rama'), (select id from public.secciones where codigo = 'frutas' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 2', 'Mesa de verdura'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'barra-pan'), (select id from public.secciones where codigo = 'panaderia' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 3', 'Cesta caliente'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'croissant-mantequilla'), (select id from public.secciones where codigo = 'panaderia' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 3', 'Vitrina dulce'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'agua-mineral-15'), (select id from public.secciones where codigo = 'bebidas' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 5', 'Palé central'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'refresco-cola'), (select id from public.secciones where codigo = 'bebidas' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 6', 'Estantería superior'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'pizza-margarita'), (select id from public.secciones where codigo = 'congelados' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 7', 'Arcón congelador'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'helado-vainilla'), (select id from public.secciones where codigo = 'congelados' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 7', 'Congelador izquierdo'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'detergente-liquido'), (select id from public.secciones where codigo = 'limpieza' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 8', 'Estantería inferior'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'papel-higienico'), (select id from public.secciones where codigo = 'limpieza' and tienda_id = (select id from public.tiendas where codigo = 'tienda-demo')), 'Pasillo 8', 'Cabecera de pasillo')
on conflict (tienda_id, producto_id) do update set
  seccion_id = excluded.seccion_id,
  pasillo = excluded.pasillo,
  estanteria = excluded.estanteria;

insert into public.inventario (tienda_id, producto_id, cantidad, estado)
values
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'yogur-natural-hacendado'), 42, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'leche-entera-puleva'), 8, 'pocas_unidades'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'queso-fresco-burgos'), 24, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'platano-canarias'), 60, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'tomate-rama'), 36, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'barra-pan'), 80, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'croissant-mantequilla'), 6, 'pocas_unidades'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'agua-mineral-15'), 120, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'refresco-cola'), 55, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'pizza-margarita'), 22, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'helado-vainilla'), 0, 'agotado'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'detergente-liquido'), 18, 'disponible'),
  ((select id from public.tiendas where codigo = 'tienda-demo'), (select id from public.productos where codigo = 'papel-higienico'), 5, 'pocas_unidades')
on conflict (tienda_id, producto_id) do update set
  cantidad = excluded.cantidad,
  estado = excluded.estado;
