const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API = `${BASE_URL}/api`;

// Helper genérico
async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ==================== PANEL DOCENTE ====================

/** Login panel */
export const loginPanel = (credentials) => 
  request('/panel/auth/login', { method: 'POST', body: JSON.stringify(credentials) });

/** Obtener disponibilidad del docente autenticado */
export const obtenerDisponibilidadDocente = () => 
  request('/panel/docente/disponibilidad');

/** Guardar bloques de disponibilidad */
export const guardarDisponibilidad = (body) => 
  request('/panel/docente/disponibilidad', { method: 'POST', body: JSON.stringify(body) });

/** Sugerir bloques con IA */
export const sugerirDisponibilidadIA = () => 
  request('/panel/docente/disponibilidad/sugerir');

/** Obtener citas pendientes del docente */
export const obtenerCitasPendientesDocente = () => 
  request('/panel/docente/citas-pendientes'); // (crearemos mock por ahora)

/** Obtener briefing IA de una cita */
export const obtenerBriefingCita = (citaId) => 
  request(`/edubot/cita/${citaId}/contexto`);

/** Generar Acta PDF */
export const generarActa = (citaId, notasLibres) => 
  request(`/edubot/cita/${citaId}/acta`, { 
    method: 'POST', 
    body: JSON.stringify({ notasLibres }) 
  });

export { 
  validarPadre, listarDocentes, confirmarCita, 
  obtenerCitasPadre, cancelarCita 
} from './api.js'; // mantén lo anterior