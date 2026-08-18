-- Esquema para "Organizador de Programas CNC"
-- Ejecutar en el SQL editor de tu proyecto Supabase.

create table if not exists public.tareas_externas (
  id bigserial primary key,
  precedentes boolean,
  estado text,
  tarea text not null,
  descripcion text,
  modelo text,
  ot text,
  componente text,
  os text,
  inicio timestamptz,
  fin date,
  descripcion_parte text,
  descripcion_os text,
  segmento_externo text,
  segmento text,
  seccion text,
  proveedor text,
  cliente text,
  cambios_etas text,
  importado_en timestamptz not null default now(),
  unique (tarea, os)
);

create table if not exists public.tareas_pendientes (
  id bigserial primary key,
  precedentes boolean,
  estado text,
  tarea text not null,
  descripcion text,
  ot text,
  os text,
  descripcion_os text,
  segmento text,
  seccion text,
  maquina text,
  modelo text,
  componente text,
  parte text,
  inicio timestamptz,
  fin timestamptz,
  horas text,
  avance_wo text,
  importado_en timestamptz not null default now(),
  unique (tarea)
);

create index if not exists idx_tareas_externas_os on public.tareas_externas (os);
create index if not exists idx_tareas_pendientes_os on public.tareas_pendientes (os);
create index if not exists idx_tareas_pendientes_maquina on public.tareas_pendientes (maquina);

-- RLS: habilitado con acceso abierto para simplificar el arranque (herramienta
-- interna de planta, sin login). Si más adelante agregas autenticación,
-- reemplaza "using (true)" por "using (auth.role() = 'authenticated')".
alter table public.tareas_externas enable row level security;
alter table public.tareas_pendientes enable row level security;

create policy "acceso_abierto_tareas_externas" on public.tareas_externas
  for all using (true) with check (true);

create policy "acceso_abierto_tareas_pendientes" on public.tareas_pendientes
  for all using (true) with check (true);
