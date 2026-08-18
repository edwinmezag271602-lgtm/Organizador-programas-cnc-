// scheduler.js
// Calcula, dado un plazo límite (deadline) y una cantidad de horas de trabajo
// necesarias, cuándo debe empezar el programador CNC a elaborar el programa,
// respetando los turnos y horarios de almuerzo/cena de la planta.
//
// Turno día:   Lun-Jue 08:00-17:30 (almuerzo 11:00-12:00) | Vie 08:00-17:00 (almuerzo 11:00-12:00)
// Turno noche: Lun-Jue 20:00-05:30 (cena 01:00-02:00)     | Vie 20:00-05:00 (cena 01:00-02:00)
// Sábado y domingo: sin turno (excepto la cola de la noche del viernes que llega hasta el sábado 05:00).

const MS_HOUR = 60 * 60 * 1000;

function atTime(date, hh, mm) {
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Genera los bloques de trabajo (ya descontando almuerzo/cena) que inician
// en el día "date" (turno día) o esa noche (turno noche que puede cruzar la medianoche).
function blocksForDay(date) {
  const dow = date.getDay(); // 0=Dom, 1=Lun ... 6=Sáb
  const blocks = [];

  // Turno día: lunes(1) a viernes(5)
  if (dow >= 1 && dow <= 5) {
    const end = dow === 5 ? atTime(date, 17, 0) : atTime(date, 17, 30);
    blocks.push([atTime(date, 8, 0), atTime(date, 11, 0)]);
    blocks.push([atTime(date, 12, 0), end]);
  }

  // Turno noche: inicia lunes(1) a viernes(5), termina al día siguiente
  if (dow >= 1 && dow <= 5) {
    const next = addDays(date, 1);
    const end = dow === 5 ? atTime(next, 5, 0) : atTime(next, 5, 30);
    blocks.push([atTime(date, 20, 0), atTime(next, 1, 0)]);
    blocks.push([atTime(next, 2, 0), end]);
  }

  return blocks;
}

// Genera todos los bloques de trabajo dentro de [from, to], ordenados ascendente.
function generateShiftBlocks(from, to) {
  const blocks = [];
  let cursor = addDays(from, -2); // margen para turnos de noche que cruzan medianoche
  const limit = addDays(to, 1);
  while (cursor <= limit) {
    blocks.push(...blocksForDay(cursor));
    cursor = addDays(cursor, 1);
  }
  blocks.sort((a, b) => a[0] - b[0]);
  return blocks.filter(([s, e]) => e > from && s < to);
}

// Dado un plazo límite (deadline) y las horas de trabajo requeridas,
// retrocede a través de los bloques de turno acumulando horas disponibles
// hasta completar "hoursNeeded", y devuelve la fecha/hora en que debe iniciar.
function computeStartDate(deadline, hoursNeeded) {
  const searchFrom = addDays(deadline, -21); // ventana de búsqueda hacia atrás
  const blocks = generateShiftBlocks(searchFrom, deadline).filter(([s]) => s < deadline);

  let remaining = hoursNeeded * MS_HOUR;
  let startDate = null;

  for (let i = blocks.length - 1; i >= 0; i--) {
    let [s, e] = blocks[i];
    if (e > deadline) e = deadline;
    if (e <= s) continue;
    const span = e - s;
    if (span >= remaining) {
      startDate = new Date(e - remaining);
      remaining = 0;
      break;
    } else {
      remaining -= span;
      startDate = s;
    }
  }

  return { startDate, fullyScheduled: remaining <= 0 };
}

// Punto de entrada principal: calcula cuándo debe iniciar el programador
// para un requerimiento cuya fecha de fabricación es "fechaFabricacion".
// leadHours: horas mínimas de anticipación (por defecto 36h = 1.5 días).
// workHours: horas que toma elaborar el programa (rango 6-8h, se usa el máximo por defecto).
function calcularInicioProgramacion(fechaFabricacion, { leadHours = 36, workHours = 8 } = {}) {
  const readyBy = new Date(fechaFabricacion.getTime() - leadHours * MS_HOUR);
  const { startDate, fullyScheduled } = computeStartDate(readyBy, workHours);
  return { readyBy, startDate, fullyScheduled };
}

window.Scheduler = { calcularInicioProgramacion, generateShiftBlocks, computeStartDate };
