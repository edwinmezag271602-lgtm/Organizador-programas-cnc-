// app.js — Cruce de datos y render de la lista de requerimientos CNC.

const { KEYWORDS_FABRICACION, MAQUINA_EXCLUIDA, MAQUINA_CNC, DESC_ALISTAR } = window.Reglas;

const ESTADO_LABELS = {
  "en-cola": "En cola",
  ok: "OK",
  cancelada: "Cancelada",
  "en-espera": "En espera",
};

let ultimaCola = [];
let ultimoSinCruce = [];

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

function calcularCola(externas, pendientes, seguimientoPorOs) {
  const requerimientos = externas.filter((r) => r.descripcion && DESC_ALISTAR.test(r.descripcion));

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
    const seguimiento = seguimientoPorOs.get(os) ?? { estado: "en-cola", observaciones: "" };
    const matches = porOsFabricacion.get(os);

    const base = {
      os,
      tarea: req.tarea,
      componente: req.componente,
      modelo: req.modelo,
      ot: req.ot,
      descripcionOs: req.descripcion_os,
      estadoOs: req.estado,
      estado: seguimiento.estado,
      observaciones: seguimiento.observaciones ?? "",
    };

    if (!matches || matches.length === 0) {
      sinCruce.push({ ...base, maquinas: [], partes: [] });
      continue;
    }
    const fechasValidas = matches.map((m) => m.inicio).filter(Boolean).sort();
    const fechaFabricacion = fechasValidas[0] ? new Date(fechasValidas[0]) : null;
    if (!fechaFabricacion) {
      sinCruce.push({ ...base, maquinas: [], partes: [] });
      continue;
    }

    const { readyBy, startDate } = Scheduler.calcularInicioProgramacion(fechaFabricacion, {
      leadHours: 36,
      workHours: 8,
    });

    const now = new Date();
    let urgencia = "a-tiempo";
    if (startDate && startDate <= now) urgencia = "atrasado";
    else if (startDate && startDate - now <= 24 * 3600 * 1000) urgencia = "proximo";

    cola.push({
      ...base,
      fechaFabricacion,
      readyBy,
      startDate,
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

function selectEstado(item) {
  const opciones = Object.entries(ESTADO_LABELS)
    .map(([val, label]) => `<option value="${val}" ${item.estado === val ? "selected" : ""}>${label}</option>`)
    .join("");
  return `<select class="sel-estado" data-os="${item.os}">${opciones}</select>`;
}

function renderFila(item, conCruce) {
  return `
    <article class="fila estado-${item.estado} ${conCruce ? item.urgencia : ""}" data-os="${item.os}">
      <div class="fila-principal">
        <div class="fila-encabezado">
          <span class="os">${item.os}</span>
          ${conCruce ? badgeUrgencia(item.urgencia) : `<span class="badge badge-gris">Sin cruce</span>`}
        </div>
        <p class="desc">${item.descripcionOs ?? "—"}</p>
      </div>
      <div class="dato" data-label="Componente">${item.componente ?? "—"}</div>
      <div class="dato" data-label="Máquina(s)">${item.maquinas.join(", ") || "—"}</div>
      <div class="dato" data-label="Parte(s)">${item.partes.join(", ") || "—"}</div>
      <div class="dato" data-label="Fabricación programada">${conCruce ? fmtFecha(item.fechaFabricacion) : "—"}</div>
      <div class="dato" data-label="Programa debe estar listo">${conCruce ? fmtFecha(item.readyBy) : "—"}</div>
      <div class="dato" data-label="El programador debe iniciar"><strong>${conCruce ? fmtFecha(item.startDate) : "—"}</strong></div>
      <div class="dato" data-label="Estado">${selectEstado(item)}</div>
      <div class="dato dato-obs" data-label="Observaciones">
        <textarea class="txt-obs" data-os="${item.os}" rows="1" placeholder="Observaciones…">${item.observaciones ?? ""}</textarea>
      </div>
    </article>`;
}

function aplicarFiltros(cola) {
  const texto = document.getElementById("filtro-texto").value.trim().toLowerCase();
  const urgencia = document.getElementById("filtro-urgencia").value;
  const maquina = document.getElementById("filtro-maquina").value;
  const estado = document.getElementById("filtro-estado").value;

  return cola.filter((item) => {
    if (estado === "activos" && !["en-cola", "en-espera"].includes(item.estado)) return false;
    if (estado !== "activos" && estado !== "todas" && item.estado !== estado) return false;
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
  const actual = select.value;
  const maquinas = [...new Set(cola.flatMap((i) => i.maquinas))].sort();
  select.innerHTML =
    `<option value="todas">Todas las máquinas</option>` +
    maquinas.map((m) => `<option value="${m}">${m}</option>`).join("");
  if (maquinas.includes(actual)) select.value = actual;
}

function render() {
  const filtrada = aplicarFiltros(ultimaCola);
  document.getElementById("resumen").textContent =
    `${filtrada.length} requerimiento(s) en cola` +
    (filtrada.length !== ultimaCola.length ? ` (de ${ultimaCola.length} totales)` : "");
  document.getElementById("cola").innerHTML =
    filtrada.map((i) => renderFila(i, true)).join("") || "<p class='vacio'>Sin resultados.</p>";

  const sinCruceFiltrado = aplicarFiltrosSinEstadoUrgencia(ultimoSinCruce);
  document.getElementById("sin-cruce").innerHTML = sinCruceFiltrado.map((i) => renderFila(i, false)).join("");
  document.getElementById("sin-cruce-count").textContent = sinCruceFiltrado.length;
}

function aplicarFiltrosSinEstadoUrgencia(lista) {
  const estado = document.getElementById("filtro-estado").value;
  return lista.filter((item) => {
    if (estado === "activos" && !["en-cola", "en-espera"].includes(item.estado)) return false;
    if (estado !== "activos" && estado !== "todas" && item.estado !== estado) return false;
    return true;
  });
}

async function guardarSeguimiento(os, cambios) {
  const { error } = await window.supabaseClient
    .from("seguimiento_requerimientos")
    .upsert({ os, ...cambios, actualizado_en: new Date().toISOString() }, { onConflict: "os" });
  if (error) console.error("Error guardando seguimiento:", error.message);
}

function actualizarLocal(os, cambios) {
  for (const item of [...ultimaCola, ...ultimoSinCruce]) {
    if (item.os === os) Object.assign(item, cambios);
  }
}

let debounceObs = {};
function onCambioLista(ev) {
  const os = ev.target.dataset.os;
  if (!os) return;

  if (ev.target.classList.contains("sel-estado")) {
    const estado = ev.target.value;
    actualizarLocal(os, { estado });
    guardarSeguimiento(os, { estado });
    const fila = ev.target.closest(".fila");
    if (fila) fila.className = fila.className.replace(/estado-\S+/, `estado-${estado}`);
  }

  if (ev.target.classList.contains("txt-obs")) {
    const observaciones = ev.target.value;
    actualizarLocal(os, { observaciones });
    clearTimeout(debounceObs[os]);
    debounceObs[os] = setTimeout(() => guardarSeguimiento(os, { observaciones }), 600);
  }
}

async function cargarDatos() {
  document.getElementById("estado-carga").textContent = "Cargando datos…";
  const [{ data: externas, error: e1 }, { data: pendientes, error: e2 }, { data: seguimiento, error: e3 }] =
    await Promise.all([
      window.supabaseClient.from("tareas_externas").select("*"),
      window.supabaseClient.from("tareas_pendientes").select("*"),
      window.supabaseClient.from("seguimiento_requerimientos").select("*"),
    ]);
  if (e1 || e2 || e3) {
    document.getElementById("estado-carga").textContent = "Error cargando datos: " + (e1 || e2 || e3).message;
    return;
  }
  const seguimientoPorOs = new Map((seguimiento ?? []).map((s) => [s.os, s]));
  const { cola, sinCruce } = calcularCola(externas ?? [], pendientes ?? [], seguimientoPorOs);
  ultimaCola = cola;
  ultimoSinCruce = sinCruce;
  poblarSelectMaquinas(cola);
  render();
  document.getElementById("estado-carga").textContent = `Actualizado: ${new Date().toLocaleString("es-CO")}`;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarDatos();
  document.getElementById("filtro-texto").addEventListener("input", render);
  document.getElementById("filtro-urgencia").addEventListener("change", render);
  document.getElementById("filtro-maquina").addEventListener("change", render);
  document.getElementById("filtro-estado").addEventListener("change", render);
  document.getElementById("btn-recargar").addEventListener("click", cargarDatos);
  document.getElementById("cola").addEventListener("change", onCambioLista);
  document.getElementById("cola").addEventListener("input", onCambioLista);
  document.getElementById("sin-cruce").addEventListener("change", onCambioLista);
  document.getElementById("sin-cruce").addEventListener("input", onCambioLista);

  document.getElementById("form-carga").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fileExternas = document.getElementById("file-externas").files[0];
    const filePendientes = document.getElementById("file-pendientes").files[0];
    const status = document.getElementById("estado-import");
    status.textContent = "Importando…";
    try {
      const partes = [];
      if (fileExternas) {
        const r = await Importer.importarTareasExternas(fileExternas);
        partes.push(`${r.total} tareas externas (${r.autoCompletadas} marcadas OK automáticamente)`);
      }
      if (filePendientes) {
        const r = await Importer.importarTareasPendientes(filePendientes);
        partes.push(`${r.total} tareas pendientes`);
      }
      status.textContent = partes.length ? `Importado: ${partes.join(" · ")}` : "Selecciona al menos un archivo.";
      await cargarDatos();
    } catch (err) {
      status.textContent = "Error al importar: " + err.message;
    }
  });
});
