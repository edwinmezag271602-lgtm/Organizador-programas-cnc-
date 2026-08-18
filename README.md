# Organizador de Programas CNC

Aplicación web (HTML/CSS/JS estático + Supabase) para organizar la elaboración
de programas CNC según la cercanía de la fabricación, cruzando dos Excel que
se cargan a diario:

- **Listado de tareas externas**: se filtran las filas cuya `Descripción`
  contiene "Alistar programa/Hts" — son los requerimientos de programa CNC,
  identificados por `OS`.
- **Tareas pendientes de ejecución**: se filtran las filas cuya `Descripción`
  contiene *reconstruir*, *fabricar* o *rectificar*, y cuya `Máquina`
  contiene "CNC" (excepto **CNC Grinder 1**). Estas filas dan la fecha y
  máquina real de fabricación.

El cruce se hace por `OS`. Para cada requerimiento con fabricación asociada,
la app calcula:

1. **Fecha en que el programa debe estar listo** = fecha de inicio de
   fabricación − 1.5 días (36 h).
2. **Fecha en que el programador debe empezar a elaborar el programa** =
   retrocediendo desde el punto anterior el tiempo de trabajo necesario
   (6–8 h, por defecto 8h) contando solo horas de turno real:
   - Turno día: lunes a jueves 08:00–17:30 (almuerzo 11:00–12:00), viernes
     08:00–17:00 (almuerzo 11:00–12:00).
   - Turno noche: lunes a jueves 20:00–05:30 (cena 01:00–02:00), viernes
     20:00–05:00 (cena 01:00–02:00).

Los requerimientos se muestran en una **lista** (no tablero tipo kanban)
ordenada por urgencia (rojo = atrasado, ámbar = debe iniciar en menos de
24h, verde = a tiempo), con filtros por texto, máquina, urgencia y estado.
El diseño es responsivo (celular, tablet, escritorio).

### Seguimiento manual por OS

Cada fila tiene:

- **Estado**: `En cola` (por defecto), `OK` (ya se hizo), `Cancelada` (ya no
  se requiere), `En espera` (falta algo adicional). Se guarda de inmediato
  en la tabla `seguimiento_requerimientos`, independiente de lo que traiga
  el Excel.
- **Observaciones**: campo de texto libre, se guarda automáticamente
  (con un pequeño debounce) al escribir.

### Comportamiento al cargar el Excel del día

Cada carga de "Listado de tareas externas" **reemplaza por completo** el
contenido de `tareas_externas` (y "Tareas pendientes de ejecución" reemplaza
`tareas_pendientes`) — el Excel del día es la foto vigente.

Antes de reemplazar, la app compara las OS que estaban activas contra las
que trae el nuevo archivo:

- Si una OS **ya no aparece** en el nuevo Excel y su estado seguía siendo
  `En cola` o `En espera`, se marca automáticamente como **`OK`**
  (se entiende que la actividad se realizó y el programa "se hizo solo").
- Las **observaciones nunca se borran** en este proceso, sin importar el
  estado.
- Una OS ya marcada `OK` o `Cancelada` manualmente no se toca.

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta `supabase/schema.sql` en el SQL Editor del proyecto.
3. Copia la URL y la `anon key` del proyecto (Project Settings → API) en
   `js/config.js`.

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU-ANON-KEY",
};
```

Las políticas RLS del esquema dejan lectura/escritura abiertas para poder
arrancar rápido, ya que es una herramienta interna sin login. Si necesitas
restringir el acceso, agrega autenticación de Supabase y ajusta las políticas
en `supabase/schema.sql`.

## Uso

1. Abre `index.html` (o despliega en Netlify).
2. Despliega el panel "Cargar Excel diarios", selecciona los dos archivos del
   día y pulsa **Importar**. Los datos se guardan en Supabase (upsert, no
   duplica filas ya existentes con la misma `Tarea`).
3. La cola se recalcula automáticamente con los datos más recientes de las
   tablas `tareas_externas` y `tareas_pendientes`.

## Despliegue en Netlify

No requiere build: `publish = "."`. Basta con conectar el repositorio en
Netlify o arrastrar la carpeta al dashboard.

## Estructura

```
index.html            Tablero principal
css/styles.css         Estilos responsivos
js/config.js            Credenciales Supabase (editar)
js/supabaseClient.js    Cliente Supabase
js/scheduler.js         Cálculo de turnos y fecha de inicio del programador
js/importer.js          Parseo de los Excel (SheetJS) y upsert a Supabase
js/app.js               Cruce de datos, filtros y render del tablero
supabase/schema.sql      Esquema de base de datos
```

## Supuestos

- No se implementó login; es una herramienta interna. Se puede añadir
  Supabase Auth más adelante.
- El tiempo de elaboración del programa se toma como 8 horas (el máximo del
  rango 6–8h indicado) para ser conservador; se puede ajustar el parámetro
  `workHours` en `js/app.js`.
- El plazo de 1.5 días se interpreta como 36 horas calendario antes de la
  fecha de inicio de fabricación.
