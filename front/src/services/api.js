const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API = `${BASE_URL}/api`;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({
      error: `Error ${res.status}`
    }));

    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}

/* ===================================================
   EDUBOT CHAT
=================================================== */

export const validarPadre = (dni) =>
  request(`/edubot/padre/${dni}`);

export const listarDocentes = () =>
  request('/edubot/docentes');

export const confirmarCita = (body) =>
  request('/edubot/cita', {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const obtenerCitasPadre = (padreId) =>
  request(`/edubot/citas/${padreId}`);

export const cancelarCita = (citaId, padreId) =>
  request(`/edubot/cita/${citaId}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({
      padreId
    })
  });

/* ===================================================
   PANEL DOCENTE
=================================================== */

export const loginPanel = (credentials) =>
  request('/panel/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });

export const obtenerDisponibilidadDocente = () =>
  request('/panel/docente/disponibilidad');

export const guardarDisponibilidad = (body) =>
  request('/panel/docente/disponibilidad', {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const sugerirDisponibilidadIA = () =>
  request('/panel/docente/disponibilidad/sugerir');

export const obtenerCitasPendientesDocente = () =>
  request('/panel/docente/citas-pendientes');

export const obtenerBriefingCita = (citaId) =>
  request(`/edubot/cita/${citaId}/contexto`);

export const generarActa = (citaId, notasLibres) =>
  request(`/edubot/cita/${citaId}/acta`, {
    method: 'POST',
    body: JSON.stringify({
      notasLibres
    })
  });