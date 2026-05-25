/**
 * api.js — Capa de servicio que conecta el frontend con el backend EduBot.
 *
 * En desarrollo: usa http://localhost:8080 (configurable en .env)
 * En producción: usa la URL de Render configurada en VITE_API_URL
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API = `${BASE_URL}/api/edubot`;

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

/** Verifica que el backend esté activo */
export const checkHealth = () => request('/health');

/** Valida un padre por DNI. Devuelve { id, nombre, apellido, nombreEstudiante, gradoEstudiante } */
export const validarPadre = (dni) => request(`/padre/${dni}`);

/** Lista todos los docentes activos */
export const listarDocentes = () => request('/docentes');

/**
 * Obtiene horarios para un docente dado el padre y motivo.
 * Devuelve { sugerenciasIA: [...], todosLosHorarios: [...] }
 */
export const obtenerHorarios = (padreId, docenteId, motivo) =>
  request(`/horarios?padreId=${padreId}&docenteId=${docenteId}&motivo=${motivo}`);

/**
 * Confirma una cita.
 * @param {{ padreId, docenteId, disponibilidadId, motivo }} body
 * @returns {{ ticket, citaId, docente, curso, fecha, horaInicio, horaFin, motivo, mensaje }}
 */
export const confirmarCita = (body) =>
  request('/cita', { method: 'POST', body: JSON.stringify(body) });

/** Historial de citas de un padre */
export const obtenerCitasPadre = (padreId) => request(`/citas/${padreId}`);

/**
 * Cancela una cita.
 * @param {number} citaId
 * @param {number} padreId
 */
export const cancelarCita = (citaId, padreId) =>
  request(`/cita/${citaId}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ padreId }),
  });
