import React, { useState, useEffect } from 'react';
import { obtenerCitasPadre, cancelarCita } from '../services/api';
import '../assets/styles/MisCitas.css';

const ESTADO_LABEL = {
  confirmada: { label: 'Confirmada', color: '#27ae60', bg: '#e8f8f0' },
  cancelada:  { label: 'Cancelada',  color: '#e74c3c', bg: '#fdf0ef' },
  completada: { label: 'Completada', color: '#2980b9', bg: '#eaf4fb' },
  pendiente:  { label: 'Pendiente',  color: '#f39c12', bg: '#fef9ec' },
};

function formatFechaLarga(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function MisCitas({ padre, onVolver }) {
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelando, setCancelando] = useState(null);

  useEffect(() => {
    if (!padre?.id) return;
    setLoading(true);
    obtenerCitasPadre(padre.id)
      .then(setCitas)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [padre]);

  async function handleCancelar(cita) {
    if (!window.confirm(`¿Cancelar cita con ${cita.docente} el ${formatFechaLarga(cita.fecha)}?`)) return;
    setCancelando(cita.id);
    try {
      await cancelarCita(cita.id, padre.id);
      setCitas(prev => prev.map(c => c.id === cita.id ? { ...c, estado: 'cancelada' } : c));
    } catch (e) {
      alert('No se pudo cancelar: ' + e.message);
    } finally {
      setCancelando(null);
    }
  }

  const estadoBadge = (estado) => {
    const cfg = ESTADO_LABEL[estado] || ESTADO_LABEL.pendiente;
    return (
      <span style={{ fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.color, padding:'3px 10px', borderRadius:12 }}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="mis-citas-wrap">
      <div className="mis-citas-header">
        <button className="mc-back" onClick={onVolver}>← Volver</button>
        <h2 className="mc-title">🗂️ Mis Citas</h2>
        <p className="mc-subtitle">Hola <strong>{padre?.nombre}</strong> — historial completo</p>
      </div>

      {loading && (
        <div className="mc-loading">
          <div className="mc-spinner" />
          <span>Cargando citas...</span>
        </div>
      )}

      {error && (
        <div className="mc-error">
          ❌ {error}
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      )}

      {!loading && !error && citas.length === 0 && (
        <div className="mc-empty">
          <span className="mc-empty-icon">📭</span>
          <p>No tienes citas registradas aún.</p>
          <button className="mc-agendar-btn" onClick={onVolver}>Agendar primera cita</button>
        </div>
      )}

      {!loading && !error && citas.length > 0 && (
        <div className="mc-list">
          {citas.map(cita => (
            <div key={cita.id} className={`mc-card ${cita.estado}`}>
              <div className="mc-card-top">
                <div className="mc-card-info">
                  <div className="mc-card-docente">{cita.docente}</div>
                  <div className="mc-card-curso">{cita.curso}</div>
                </div>
                {estadoBadge(cita.estado)}
              </div>
              <div className="mc-card-mid">
                <div className="mc-detail"><span>📅</span> {formatFechaLarga(cita.fecha)}</div>
                <div className="mc-detail"><span>🕐</span> {cita.horaInicio} – {cita.horaFin}</div>
                <div className="mc-detail"><span>📌</span> {cita.motivo}</div>
              </div>
              <div className="mc-card-foot">
                <span className="mc-ticket">{cita.ticket}</span>
                {cita.estado === 'confirmada' && (
                  <button
                    className="mc-cancelar-btn"
                    onClick={() => handleCancelar(cita)}
                    disabled={cancelando === cita.id}
                  >
                    {cancelando === cita.id ? 'Cancelando...' : 'Cancelar cita'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
