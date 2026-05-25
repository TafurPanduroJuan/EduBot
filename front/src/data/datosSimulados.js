/**
 * datosSimulados.js — Solo datos estáticos locales.
 * Los padres y docentes ahora vienen del backend.
 *
 * Kept: motivosCita, generarCodigoCita
 */

export const motivosCita = [
  { id: 'rendimiento', label: 'Rendimiento académico', icon: '📊' },
  { id: 'conducta',   label: 'Conducta',               icon: '❤️' },
  { id: 'bienestar',  label: 'Bienestar',              icon: '🌿' },
  { id: 'matricula',  label: 'Matrícula',              icon: '📋' },
];

export function generarCodigoCita(fecha) {
  if (!fecha) return 'EDB-????';
  const d = String(fecha).replace(/-/g, '');
  return `EDB-${d}`;
}
