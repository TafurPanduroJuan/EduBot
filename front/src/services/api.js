const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API = `${BASE_URL}/api`;

// ── Gestión del token JWT ────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('edubot_token');
export const setToken = (token) => localStorage.setItem('edubot_token', token);
export const removeToken = () => localStorage.removeItem('edubot_token');

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}

async function requestBlob(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.blob();
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
    body: JSON.stringify(body),
  });

export const obtenerCitasPadre = (padreId) =>
  request(`/edubot/citas/${padreId}`);

export const cancelarCita = (citaId, padreId) =>
  request(`/edubot/cita/${citaId}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ padreId }),
  });

/* ===================================================
   AUTH — PANEL (DOCENTE / ADMINISTRATIVO)
=================================================== */

export const loginPanel = async (credentials) => {
  const resp = await request('/panel/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  // Guardar el token automáticamente tras login exitoso
  if (resp.token) setToken(resp.token);
  return resp;
};

/* ===================================================
   PANEL DOCENTE
=================================================== */

export const obtenerDisponibilidadDocente = () =>
  request('/panel/docente/disponibilidad');

export const guardarDisponibilidad = (body) =>
  request('/panel/docente/disponibilidad', {
    method: 'POST',
    body: JSON.stringify(body),
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
    body: JSON.stringify({ notasLibres }),
  });

/* ===================================================
   PANEL ADMINISTRATIVO (HU008 / HU009)
=================================================== */

/**
 * GET /api/panel/admin/dashboard/resumen?periodo=mensual|semanal|anual
 * Retorna DashboardResumenDTO con métricas reales de la BD.
 */
export const obtenerResumenDashboard = (periodo = 'mensual') =>
  request(`/panel/admin/dashboard/resumen?periodo=${periodo}`);

/**
 * GET /api/panel/admin/disponibilidades
 * Lista todas las disponibilidades de todos los docentes (solo lectura admin).
 */
export const obtenerTodasDisponibilidades = () =>
  request('/panel/admin/disponibilidades');

/**
 * GET /api/panel/admin/disponibilidades/:docenteId
 * Disponibilidades de un docente específico.
 */
export const obtenerDisponibilidadesPorDocente = (docenteId) =>
  request(`/panel/admin/disponibilidades/${docenteId}`);

/**
 * GET /api/panel/admin/reportes/exportar?formato=excel|pdf|csv&periodo=mensual|semanal|anual
 * Descarga el archivo generado por el backend.
 */
export const exportarReporteBackend = async (formato, periodo = 'mensual') => {
  const blob = await requestBlob(
    `/panel/admin/reportes/exportar?formato=${formato}&periodo=${periodo}`
  );
  const ext = formato === 'excel' ? 'xlsx' : formato;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edubot_${periodo}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};