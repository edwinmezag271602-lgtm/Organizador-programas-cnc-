// app.js — Cruce de datos y render del tablero de cola de programas CNC.

const KEYWORDS_FABRICACION = /reconstruir|fabricar|rectificar/i;
const MAQUINA_EXCLUIDA = /cnc grinder 1/i;
const MAQUINA_CNC = /cnc/i;
const DESC_ALISTAR = /alistar\s+programa.*hts/i;

let ultimaCola = [];

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcularCola(externas, pendientes) {
  const requerimientos = externas.filter((r) => r.descripcion && DESC_ALISTAR.test(r.descripcion));

  // Deduplicar por OS, conservando el primer registro como referencia.
  const porOs = new Map();
  for (const r of requerimientos) {
    if (!r.os) continue;
    if (!porOs.has(r.os)) porOs.set(r.os, r);
  }

  const candidatosFabricacion = pendientes.filter(
    (p) =>
      p.maquina &&
      MAQUINA_CNC.test(p.maquina) &&
      !MAQUINA_EXCLUIDA.test(p.maquina) &&
      p.descripcion &&
      KEYWORDS_FABRICACION.test(p.descripcion)
  );

  const porOsFabricacion = new Map();
  for (const c of candidatosFabricacion) {
    if (!c.os) continue;
    if (!porOsFabricacion.has(c.os)) porOsFabricacion.set(c.os, []);
    porOsFabricacion.get(c.os).push(c);
  }

  const cola = [];
  const sinCruce = [];

  for (const [os, req] of porOs.entries()) {
    const matches = porOsFabricacion.get(os);
    if (!matches || matches.length === 0) {
      sinCruce.push(req);
      continue;
    }
    const fechasValidas = matches.map((m) => m.inicio).filter(Boolean).sort();
    const fechaFabricacion = fechasValidas[0] ? new Date(fechasValidas[0]) : null;
    if (!fechaFabricacion) {
      sinCruce.push(req);
      continue;
    }

    const { readyBy, startDate, fullyScheduled } = Scheduler.calcularInicioProgramacion(fechaFabricacion, {
      leadHours: 36,
      workHours: 8,
    });

    const now = new Date();
    let urgencia = "a-tiempo";
    if (startDate && startDate <= now) urgencia = "atrasado";
    else if (startDate && startDate - now <= 24 * 3600 * 1000) urgencia = "proximo";

    cola.push({
      os,
      tarea: req.tarea,
      componente: req.componente,
      modelo: req.modelo,
      ot: req.ot,
      descripcionOs: req.descripcion_os,
      estado: req.estado,
      fechaFabricacion,
      readyBy,
      startDate,
      fullyScheduled,
      urgencia,
      maquinas: [...new Set(matches.map((m) => m.maquina))],
      partes: [...new Set(matches.map((m) => m.parte).filter(Boolean))],
    });
  }

  cola.sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));
  return { cola, sinCruce };
}

function badgeUrgencia(u) {
  const map = {
    atrasado: ["Atrasado", "badge-rojo"],
    proximo: ["Próximo (<24h)", "badge-ambar"],
    "a-tiempo": ["A tiempo", "badge-verde"],
  };
  const [label, cls] = map[u] ?? ["—", ""];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderCard(item) {
  return `
    <article class="card ${item.urgencia}">
      <header>
        <span class="os">${item.os}</span>
        ${badgeUrgencia(item.urgencia)}
      </header>
      <p class="desc">${item.descripcionOs ?? "—"}</p>
      <dl>
        <dt>Componente</dt><dd>${item.componente ?? "—"}</dd>
        <dt>Modelo / OT</dt><dd>${item.modelo ?? "—"} / ${item.ot ?? "—"}</dd>
        <dt>Máquina(s)</dt><dd>${item.maquinas.join(", ") || "—"}</dd>
        <dt>Parte(s)</dt><dd>${item.partes.join(", ") || "—"}</dd>
        <dt>Fabricación programada</dt><dd>${fmtFecha(item.fechaFabricacion)}</dd>
        <dt>Programa CNC debe estar listo</dt><dd>${fmtFecha(item.readyBy)}</dd>
        <dt>El programador debe iniciar</dt><dd><strong>${fmtFecha(item.startDate)}</strong></dd>
      </dl>
    </article>`;
}

function renderSinCruce(item) {
  return `
    <article class="card sin-cruce">
      <header>
        <span class="os">${item.os ?? "—"}</span>
        <span class="badge badge-gris">Sin cruce</span>
      </header>
      <p class="desc">${item.descripcion_os ?? item.descripcion ?? "—"}</p>
      <dl>
        <dt>Componente</dt><dd>${item.componente ?? "—"}</dd>
        <dt>Tarea</dt><dd>${item.tarea ?? "—"}</dd>
      </dl>
    </article>`;
}

function aplicarFiltros(cola) {
  const texto = document.getElementById("filtro-texto").value.trim().toLowerCase();
  const urgencia = document.getElementById("filtro-urgencia").value;
  const maquina = document.getElementById("filtro-maquina").value;

  return cola.filter((item) => {
    if (urgencia !== "todas" && item.urgencia !== urgencia) return false;
    if (maquina !== "todas" && !item.maquinas.includes(maquina)) return false;
    if (texto) {
      const haystack = `${item.os} ${item.componente} ${item.descripcionOs} ${item.partes.join(" ")}`.toLowerCase();
      if (!haystack.includes(texto)) return false;
    }
    return true;
  });
}

function poblarSelectMaquinas(cola) {
  const select = document.getElementById("filtro-maquina");
  const actuales = new Set(select.value ? [select.value] : []);
  const maquinas = [...new Set(cola.flatMap((i) => i.maquinas))].sort();
  select.innerHTML =
    `<option value="todas">Todas las máquinas</option>` +
    maquinas.map((m) => `<option value="${m}">${m}</option>`).join("");
  if (actuales.size && maquinas.includes([...actuales][0])) select.value = [...actuales][0];
}

function render() {
  const filtrada = aplicarFiltros(ultimaCola);
  document.getElementById("resumen").textContent =
    `${filtrada.length} requerimiento(s) en cola` +
    (filtrada.length !== ultimaCola.length ? ` (de ${ultimaCola.length} totales)` : "");
  document.getElementById("cola").innerHTML = filtrada.map(renderCard).join("") || "<p class='vacio'>Sin resultados.</p>";
}

async function cargarDatos() {
  document.getElementById("estado-carga").textContent = "Cargando datos…";
  const [{ data: externas, error: e1 }, { data: pendientes, error: e2 }] = await Promise.all([
    window.supabaseClient.from("tareas_externas").select("*"),
    window.supabaseClient.from("tareas_pendientes").select("*"),
  ]);
  if (e1 || e2) {
    document.getElementById("estado-carga").textContent = "Error cargando datos: " + (e1 || e2).message;
    return;
  }
  const { cola, sinCruce } = calcularCola(externas ?? [], pendientes ?? []);
  ultimaCola = cola;
  poblarSelectMaquinas(cola);
  render();
  document.getElementById("sin-cruce").innerHTML = sinCruce.map(renderSinCruce).join("");
  document.getElementById("sin-cruce-count").textContent = sinCruce.length;
  document.getElementById("estado-carga").textContent =
    `Actualizado: ${new Date().toLocaleString("es-CO")}`;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarDatos();
  document.getElementById("filtro-texto").addEventListener("input", render);
  document.getElementById("filtro-urgencia").addEventListener("change", render);
  document.getElementById("filtro-maquina").addEventListener("change", render);
  document.getElementById("btn-recargar").addEventListener("click", cargarDatos);

  document.getElementById("form-carga").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fileExternas = document.getElementById("file-externas").files[0];
    const filePendientes = document.getElementById("file-pendientes").files[0];
    const status = document.getElementById("estado-import");
    status.textContent = "Importando…";
    try {
      const partes = [];
      if (fileExternas) partes.push(`${await Importer.importarTareasExternas(fileExternas)} tareas externas`);
      if (filePendientes) partes.push(`${await Importer.importarTareasPendientes(filePendientes)} tareas pendientes`);
      status.textContent = partes.length ? `Importado: ${partes.join(" · ")}` : "Selecciona al menos un archivo.";
      await cargarDatos();
    } catch (err) {
      status.textContent = "Error al importar: " + err.message;
    }
  });
});
