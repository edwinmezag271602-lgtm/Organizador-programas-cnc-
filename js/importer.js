// importer.js — Lee los dos Excel diarios (SheetJS) y los sube a Supabase.

function parseFechaDDMMYYYY(value) {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  if (value instanceof Date) return value.toISOString();
  const str = String(value).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "0", min = "0"] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toUpperCase();
  return s === "TRUE" || s === "VERDADERO" || s === "1";
}

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

async function readSheetRows(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

async function parseTareasExternas(file) {
  const rows = await readSheetRows(file);
  return rows
    .filter((r) => textOrNull(r["Tarea"]))
    .map((r) => ({
      precedentes: toBool(r["Precedentes"]),
      estado: textOrNull(r["Estado"]),
      tarea: textOrNull(r["Tarea"]),
      descripcion: textOrNull(r["Descripción"]),
      modelo: textOrNull(r["Modelo"]),
      ot: textOrNull(r["OT"]),
      componente: textOrNull(r["Componente"]),
      os: textOrNull(r["OS"]),
      inicio: parseFechaDDMMYYYY(r["Inicio"]),
      fin: parseFechaDDMMYYYY(r["Fin"]),
      descripcion_parte: textOrNull(r["Descripción de parte"]),
      descripcion_os: textOrNull(r["Descripción OS"]),
      segmento_externo: textOrNull(r["Segmento externo"]),
      segmento: textOrNull(r["Segmento"]),
      seccion: textOrNull(r["Sección"]),
      proveedor: textOrNull(r["Proveedor"]),
      cliente: textOrNull(r["Cliente"]),
      cambios_etas: textOrNull(r["Cambios ETAs"]),
    }));
}

async function parseTareasPendientes(file) {
  const rows = await readSheetRows(file);
  return rows
    .filter((r) => textOrNull(r["Tarea"]))
    .map((r) => ({
      precedentes: toBool(r["Precedentes"]),
      estado: textOrNull(r["Estado"]),
      tarea: textOrNull(r["Tarea"]),
      descripcion: textOrNull(r["Descripción"]),
      ot: textOrNull(r["OT"]),
      os: textOrNull(r["OS"]),
      descripcion_os: textOrNull(r["Descripción OS"]),
      segmento: textOrNull(r["Segmento"]),
      seccion: textOrNull(r["Sección"]),
      maquina: textOrNull(r["Máquina"]),
      modelo: textOrNull(r["Modelo"]),
      componente: textOrNull(r["Componente"]),
      parte: textOrNull(r["Parte"]),
      inicio: parseFechaDDMMYYYY(r["Inicio"]),
      fin: parseFechaDDMMYYYY(r["Fin"]),
      horas: textOrNull(r["Horas"]),
      avance_wo: textOrNull(r["% avance WO"]),
    }));
}

async function upsertEnLotes(table, rows, onConflict, lote = 500) {
  for (let i = 0; i < rows.length; i += lote) {
    const chunk = rows.slice(i, i + lote);
    const { error } = await window.supabaseClient.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

async function importarTareasExternas(file) {
  const rows = await parseTareasExternas(file);
  await upsertEnLotes("tareas_externas", rows, "tarea,os");
  return rows.length;
}

async function importarTareasPendientes(file) {
  const rows = await parseTareasPendientes(file);
  await upsertEnLotes("tareas_pendientes", rows, "tarea");
  return rows.length;
}

window.Importer = { importarTareasExternas, importarTareasPendientes };
