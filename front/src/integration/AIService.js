/**
 * AIService.js — Capa de Integración IA (Arquitectura M-V-C-BD)
 *
 * Propósito:
 *   Encapsula toda la comunicación con la IA del backend de EduBot,
 *   desacoplando esta responsabilidad del controlador (EduBotChat.jsx)
 *   y de la capa de servicios CRUD (api.js).
 *
 * Principios aplicados:
 *   - Baja dependencia entre capas: la UI no conoce la URL ni el formato
 *     interno de los endpoints de IA.
 *   - Capa IA independiente: AIService es el único punto de contacto con
 *     la lógica de predicción y sugerencia del backend.
 *   - Estandarización: todas las respuestas IA se normalizan al mismo
 *     formato interno { sugerencias, todos, error } antes de llegar
 *     a los componentes.
 *
 * Uso:
 *   import AIService from '../integration/AIService';
 *   const resultado = await AIService.obtenerSugerencias(padreId, docenteId, motivo);
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const AI_ENDPOINT = `${BASE_URL}/api/edubot`;

// ─── Tipos normalizados ───────────────────────────────────────────────────────

/**
 * @typedef {Object} SugerenciaIA
 * @property {number}  disponibilidadId  - ID del slot de disponibilidad
 * @property {string}  fecha             - Fecha ISO (YYYY-MM-DD)
 * @property {string}  horaInicio        - Hora de inicio (HH:mm)
 * @property {string}  horaFin           - Hora de fin (HH:mm)
 * @property {number}  score             - Porcentaje de compatibilidad (0-99)
 * @property {string}  razon             - Razón legible para el usuario
 */

/**
 * @typedef {Object} ResultadoSugerencias
 * @property {SugerenciaIA[]} sugerencias  - Top 3 horarios sugeridos por IA
 * @property {Object[]}       todos        - Todos los horarios disponibles
 * @property {string|null}    error        - Mensaje de error si ocurrió alguno
 */

// ─── Utilidad interna ─────────────────────────────────────────────────────────

async function _aiRequest(path, options = {}) {
  const res = await fetch(`${AI_ENDPOINT}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Error HTTP ${res.status}` }));
    throw new Error(err.error || `Error HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Normalización de respuesta ───────────────────────────────────────────────

/**
 * Normaliza la respuesta cruda del backend al formato interno estándar.
 * Garantiza que la UI siempre reciba la misma estructura,
 * independientemente de cambios en el API del backend.
 *
 * @param {Object} raw - Respuesta cruda del endpoint /horarios
 * @returns {ResultadoSugerencias}
 */
function _normalizar(raw) {
  const sugerencias = (raw.sugerenciasIA || []).map((s) => ({
    disponibilidadId: s.disponibilidadId,
    fecha:            s.fecha,
    horaInicio:       s.horaInicio,
    horaFin:          s.horaFin,
    score:            s.score ?? 0,
    razon:            s.razon ?? 'Horario disponible',
  }));

  const todos = (raw.todosLosHorarios || []).map((h) => ({
    disponibilidadId: h.disponibilidadId,
    fecha:            h.fecha,
    horaInicio:       h.horaInicio,
    horaFin:          h.horaFin,
  }));

  return { sugerencias, todos, error: null };
}

// ─── API pública de AIService ─────────────────────────────────────────────────

const AIService = {
  /**
   * Obtiene las sugerencias de horario generadas por la IA del backend,
   * junto con el listado completo de disponibilidades.
   *
   * @param {number} padreId    - ID del padre autenticado
   * @param {number} docenteId  - ID del docente seleccionado
   * @param {string} motivo     - Motivo de la cita (rendimiento|conducta|salud|otro)
   * @returns {Promise<ResultadoSugerencias>}
   */
  async obtenerSugerencias(padreId, docenteId, motivo) {
    try {
      const raw = await _aiRequest(
        `/horarios?padreId=${padreId}&docenteId=${docenteId}&motivo=${encodeURIComponent(motivo)}`
      );
      return _normalizar(raw);
    } catch (err) {
      console.error('[AIService] Error al obtener sugerencias IA:', err.message);
      return { sugerencias: [], todos: [], error: err.message };
    }
  },

  /**
   * Verifica si la capa IA del backend está operativa.
   * Útil para degradar graciosamente la experiencia si la IA no responde.
   *
   * @returns {Promise<boolean>}
   */
  async estaDisponible() {
    try {
      const data = await _aiRequest('/health');
      return data?.status === 'UP';
    } catch {
      return false;
    }
  },
};

export default AIService;