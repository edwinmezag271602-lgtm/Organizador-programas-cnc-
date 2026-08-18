// reglas.js — Criterios de negocio compartidos entre el importador y el tablero.

window.Reglas = {
  DESC_ALISTAR: /alistar\s+programa.*hts/i,
  KEYWORDS_FABRICACION: /reconstruir|fabricar|rectificar/i,
  MAQUINA_EXCLUIDA: /cnc grinder 1/i,
  MAQUINA_CNC: /cnc/i,
  ESTADOS: ["en-cola", "ok", "cancelada", "en-espera"],
  ESTADOS_FINALES: ["ok", "cancelada"],
};
