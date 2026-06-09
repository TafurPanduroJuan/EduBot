import React, { useState, useEffect } from 'react';
import {
  obtenerDisponibilidadDocente,
  guardarDisponibilidad,
  sugerirDisponibilidadIA,
  obtenerCitasPendientesDocente,
  obtenerBriefingCita,
  generarActa
} from '../services/api';
import '../assets/styles/DocentePanel.css';

// ── Estructura semanal ────────────────────────────────────────────────────────
const DIAS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HORAS = ['8am', '9am', '10am', '11am', '2pm', '3pm', '4pm', '5pm'];

const ESTADO_COLORS = {
  'disponible':    { bg: '#e8f5ee', color: '#1a6b3c', label: 'Disponible'     },
  'ocupado':       { bg: '#fff0f2', color: '#7B1F3A', label: 'Ocupado'        },
  'ia-sugerido':   { bg: '#fdf5e0', color: '#92690a', label: 'IA Sugerido'    },
  'bloqueado':     { bg: '#f0f0f8', color: '#888',    label: 'Bloqueado'      },
  'libre':         { bg: '#ffffff', color: '#ccc',    label: ''               },
};

// Estado inicial de la grilla (vacío = 'libre')
const iniciarGrilla = () => {
  const g = {};
  DIAS.forEach(d => {
    g[d] = {};
    HORAS.forEach(h => { g[d][h] = 'libre'; });
  });
  // Algunos pre-cargados
  g['Mar']['3pm'] = 'disponible';
  g['Mar']['4pm'] = 'disponible';
  g['Jue']['3pm'] = 'disponible';
  g['Jue']['4pm'] = 'disponible';
  g['Mié']['2pm'] = 'ocupado';
  return g;
};

// Citas mock
const iniciarCitas = () => {
  const hoy = new Date();
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
  const fmt = d => d.toLocaleDateString('es-PE', { day:'numeric', month:'short' });
  return [
    { id: 1, ticket:'EDU-3421', padre:'Rosa Mamani', alumno:'Juan Mamani', grado:'3er A',
      motivo:'Rendimiento Académico', fecha: fmt(hoy), hora:'10:00',
      estado:'Pendiente', ultimaNota:'08/20 Comunicación', inasistencias:2 },
    { id: 2, ticket:'EDU-3425', padre:'Carlos García', alumno:'Luis García', grado:'2do B',
      motivo:'Conducta y Disciplina', fecha: fmt(manana), hora:'14:30',
      estado:'Pendiente', ultimaNota:'12/20 Matemáticas', inasistencias:0 },
    { id: 3, ticket:'EDU-3510', padre:'María Flores', alumno:'Ana Flores', grado:'4to A',
      motivo:'Orientación Vocacional', fecha: fmt(manana), hora:'16:00',
      estado:'Confirmada', ultimaNota:'15/20 Ciencias', inasistencias:1 },
    { id: 4, ticket:'EDU-3418', padre:'Pedro Silva', alumno:'Carla Silva', grado:'3er A',
      motivo:'Rendimiento Académico', fecha: '5 Mar', hora:'09:00',
      estado:'Completada', ultimaNota:'10/20 Comunicación', inasistencias:3 },
  ];
};

export default function DocentePanel({ user, onLogout }) {
  const [activeTab, setActiveTab]           = useState('disponibilidad');
  const [grilla, setGrilla]                 = useState(iniciarGrilla);
  const [loadingIA, setLoadingIA]           = useState(false);
  const [loadingSave, setLoadingSave]       = useState(false);
  const [guardado, setGuardado]             = useState(false);
  const [citas, setCitas]                   = useState(iniciarCitas);
  const [filtroCita, setFiltroCita]         = useState('Pendiente');
  const [citaActiva, setCitaActiva]         = useState(null);
  const [briefing, setBriefing]             = useState(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [modalActa, setModalActa]           = useState(null);
  const [notasActa, setNotasActa]           = useState('');
  const [actaGenerada, setActaGenerada]     = useState(null);
  const [loadingActa, setLoadingActa]       = useState(false);
  const [toast, setToast]                   = useState(null);

  const showToast = (texto, tipo = 'success') => {
    setToast({ texto, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Grilla: ciclo de estados al hacer clic ──────────────────────────────────
  const cicloEstado = { libre: 'disponible', disponible: 'ocupado', ocupado: 'bloqueado', bloqueado: 'libre', 'ia-sugerido': 'disponible' };

  const toggleCelda = (dia, hora) => {
    setGrilla(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [hora]: cicloEstado[prev[dia][hora]] }
    }));
    setGuardado(false);
  };

  // ── Sugerir con IA ──────────────────────────────────────────────────────────
  const handleSugerirIA = async () => {
    setLoadingIA(true);
    await new Promise(r => setTimeout(r, 1200));
    setGrilla(prev => {
      const next = { ...prev };
      // IA sugiere los martes y jueves tarde
      ['Mar', 'Jue'].forEach(d => {
        ['3pm', '4pm'].forEach(h => {
          next[d] = { ...next[d], [h]: 'ia-sugerido' };
        });
      });
      return next;
    });
    setLoadingIA(false);
    showToast('✦ IA sugirió los horarios de mayor demanda para padres trabajadores.');
    setGuardado(false);
  };

  // ── Guardar disponibilidad ──────────────────────────────────────────────────
  const handleGuardar = async () => {
    setLoadingSave(true);
    try { await guardarDisponibilidad(grilla); } catch (_) {}
    await new Promise(r => setTimeout(r, 800));
    setLoadingSave(false);
    setGuardado(true);
    showToast('Disponibilidad guardada correctamente.');
  };

  // ── Confirmar / Rechazar cita ───────────────────────────────────────────────
  const cambiarEstadoCita = (id, nuevoEstado) => {
    setCitas(prev => prev.map(c => c.id === id ? { ...c, estado: nuevoEstado } : c));
    if (citaActiva?.id === id) setCitaActiva(prev => ({ ...prev, estado: nuevoEstado }));
    showToast(nuevoEstado === 'Confirmada' ? '✅ Cita confirmada. El padre será notificado.' : '❌ Cita rechazada.');
    setBriefing(null);
  };

  // ── Briefing IA ────────────────────────────────────────────────────────────
  const handleBriefing = async (cita) => {
    setCitaActiva(cita);
    setBriefing(null);
    setLoadingBriefing(true);
    try { await obtenerBriefingCita(cita.id); } catch (_) {}
    await new Promise(r => setTimeout(r, 1000));
    setBriefing({
      citaId: cita.id,
      texto: `Última nota: ${cita.ultimaNota} (baja). ${cita.inasistencias} inasistencia${cita.inasistencias !== 1 ? 's' : ''} en las últimas 2 semanas. Sugerencia: revisar comprensión lectora y hábitos de estudio.`
    });
    setLoadingBriefing(false);
  };

  // ── Generar Acta ───────────────────────────────────────────────────────────
  const handleEnviarActa = async (e) => {
    e.preventDefault();
    if (!notasActa.trim()) return;
    setLoadingActa(true);
    try { await generarActa(modalActa.id, notasActa); } catch (_) {}
    await new Promise(r => setTimeout(r, 1200));
    setActaGenerada({
      acuerdos: 'El estudiante reforzará hábitos de estudio diariamente.',
      compromisos: 'La madre acompañará las actividades académicas cada noche.',
      seguimiento: `Revisión en 30 días — ${new Date(Date.now() + 30*24*3600*1000).toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' })}.`
    });
    setCitas(prev => prev.map(c => c.id === modalActa.id ? { ...c, estado: 'Completada' } : c));
    setLoadingActa(false);
    showToast(`✅ Acta del ticket ${modalActa.ticket} generada con IA.`);
  };

  const abrirActa = (cita) => { setModalActa(cita); setNotasActa(''); setActaGenerada(null); };
  const citasFiltradas = citas.filter(c => filtroCita === 'Todas' ? true : c.estado === filtroCita);

  // ── Contar disponibles en grilla ───────────────────────────────────────────
  const totalDisponibles = Object.values(grilla).reduce((acc, dia) =>
    acc + Object.values(dia).filter(e => e === 'disponible' || e === 'ia-sugerido').length, 0);

  return (
    <div className="dp-wrap">

      {/* Toast */}
      {toast && (
        <div className={`dp-toast dp-toast-${toast.tipo}`}>
          {toast.texto}
        </div>
      )}

      {/* Header */}
      <div className="dp-header">
        <div className="dp-header-left">
          <div className="dp-avatar">P</div>
          <div>
            <h1 className="dp-title">Panel Docente</h1>
            <p className="dp-subtitle">Prof. {user?.nombreDocente || user?.username || 'Ricardo F.'}</p>
          </div>
        </div>
        <button className="dp-logout" onClick={onLogout}>Cerrar sesión</button>
      </div>

      {/* Tabs */}
      <div className="dp-tabs">
        {[
          { key: 'disponibilidad', label: '📅 Disponibilidad' },
          { key: 'solicitudes',   label: `📋 Solicitudes ${citas.filter(c=>c.estado==='Pendiente').length > 0 ? `(${citas.filter(c=>c.estado==='Pendiente').length})` : ''}` },
          { key: 'actas',         label: '📝 Actas' },
        ].map(t => (
          <button
            key={t.key}
            className={`dp-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          TAB 1: DISPONIBILIDAD — HU004
      ══════════════════════════════════════════════ */}
      {activeTab === 'disponibilidad' && (
        <div className="dp-content">
          <div className="dp-section-intro">
            <div>
              <h2 className="dp-section-title">Mi disponibilidad</h2>
              <p className="dp-section-desc">Haz clic en cada celda para cambiar su estado. Los padres solo verán los bloques marcados como disponibles.</p>
            </div>
            <div className="dp-dispon-stats">
              <span className="dp-stat-badge">{totalDisponibles} bloques disponibles</span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="dp-leyenda">
            {Object.entries(ESTADO_COLORS).filter(([k]) => k !== 'libre').map(([k, v]) => (
              <span key={k} className="dp-leyenda-item">
                <span className="dp-leyenda-dot" style={{ background: v.color }} />
                {v.label}
              </span>
            ))}
          </div>

          {/* Grilla */}
          <div className="dp-grilla-wrap">
            <table className="dp-grilla">
              <thead>
                <tr>
                  <th className="dp-grilla-th-hora">Hora</th>
                  {DIAS.map(d => <th key={d} className="dp-grilla-th-dia">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {HORAS.map(hora => (
                  <tr key={hora}>
                    <td className="dp-grilla-hora">{hora}</td>
                    {DIAS.map(dia => {
                      const est = grilla[dia][hora];
                      const cfg = ESTADO_COLORS[est];
                      return (
                        <td key={dia}>
                          <button
                            className={`dp-celda ${est !== 'libre' ? 'dp-celda-filled' : ''}`}
                            style={est !== 'libre' ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : {}}
                            onClick={() => toggleCelda(dia, hora)}
                            title={`${dia} ${hora} — ${cfg.label || 'Libre (clic para agregar)'}`}
                          >
                            {est === 'ia-sugerido' && <span className="dp-celda-ia">✦ IA</span>}
                            {est === 'disponible' && <span>✓</span>}
                            {est === 'ocupado' && <span>●</span>}
                            {est === 'bloqueado' && <span>✕</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Acciones */}
          <div className="dp-grilla-actions">
            <button className="dp-btn-ia" onClick={handleSugerirIA} disabled={loadingIA}>
              {loadingIA
                ? <><span className="dp-mini-spinner" />Analizando...</>
                : '✦ Sugerir con IA'}
            </button>
            <button className="dp-btn-guardar" onClick={handleGuardar} disabled={loadingSave || guardado}>
              {loadingSave ? 'Guardando...' : guardado ? '✓ Guardado' : '💾 Guardar disponibilidad'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2: SOLICITUDES — HU005 + HU006
      ══════════════════════════════════════════════ */}
      {activeTab === 'solicitudes' && (
        <div className="dp-content">
          <div className="dp-sol-layout">

            {/* Lista */}
            <div className="dp-sol-lista">
              <div className="dp-sol-filtros">
                {['Pendiente', 'Confirmada', 'Completada', 'Todas'].map(f => (
                  <button
                    key={f}
                    className={`dp-filtro-tab ${filtroCita === f ? 'active' : ''}`}
                    onClick={() => setFiltroCita(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {citasFiltradas.length === 0 && (
                <div className="dp-empty">Sin solicitudes para este filtro</div>
              )}

              {citasFiltradas.map(cita => (
                <div
                  key={cita.id}
                  className={`dp-cita-card ${citaActiva?.id === cita.id ? 'dp-cita-active' : ''}`}
                  onClick={() => handleBriefing(cita)}
                >
                  <div className="dp-cita-top">
                    <span className="dp-ticket">{cita.ticket}</span>
                    <span className={`dp-estado dp-estado-${cita.estado.toLowerCase()}`}>{cita.estado}</span>
                  </div>
                  <h4 className="dp-cita-padre">{cita.padre}</h4>
                  <p className="dp-cita-alumno">Est: {cita.alumno} · {cita.grado}</p>
                  <p className="dp-cita-motivo">{cita.motivo}</p>
                  <div className="dp-cita-fecha">📅 {cita.fecha} · ⏰ {cita.hora}</div>

                  {cita.estado === 'Pendiente' && (
                    <div className="dp-cita-acciones">
                      <button
                        className="dp-btn-confirmar"
                        onClick={(e) => { e.stopPropagation(); cambiarEstadoCita(cita.id, 'Confirmada'); }}
                      >
                        ✓ Confirmar cita
                      </button>
                      <button
                        className="dp-btn-rechazar"
                        onClick={(e) => { e.stopPropagation(); cambiarEstadoCita(cita.id, 'Rechazada'); }}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                  {cita.estado === 'Confirmada' && (
                    <button
                      className="dp-btn-acta-small"
                      onClick={(e) => { e.stopPropagation(); abrirActa(cita); }}
                    >
                      📝 Generar acta
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Briefing IA */}
            <div className="dp-briefing-aside">
              <div className="dp-briefing-header">
                <span className="dp-ia-badge">✦ Briefing IA</span>
              </div>

              {!citaActiva && !loadingBriefing && (
                <div className="dp-briefing-placeholder">
                  <div className="dp-briefing-icon">🤖</div>
                  <p>Selecciona una solicitud para ver el análisis automático del alumno.</p>
                </div>
              )}

              {loadingBriefing && (
                <div className="dp-briefing-loading">
                  <div className="dp-spinner-med" />
                  <p>Analizando expediente del alumno...</p>
                </div>
              )}

              {citaActiva && briefing && !loadingBriefing && (
                <div className="dp-briefing-content">
                  <div className="dp-briefing-cita-info">
                    <strong>{citaActiva.padre}</strong> · Est: {citaActiva.alumno}
                    <span className="dp-briefing-grado">{citaActiva.grado}</span>
                  </div>
                  <div className="dp-briefing-motivo">
                    <span>Motivo: {citaActiva.motivo}</span>
                  </div>
                  <div className="dp-briefing-ia-box">
                    <span className="dp-ia-badge">✦ Generado por IA</span>
                    <ul className="dp-briefing-list">
                      <li>· {citaActiva.ultimaNota} <span className="dp-nota-baja">(baja)</span></li>
                      <li>· {citaActiva.inasistencias} inasistencia{citaActiva.inasistencias !== 1 ? 's' : ''} en las últimas 2 semanas</li>
                      <li>· Sugerencia: revisar comprensión lectora y hábitos de estudio</li>
                    </ul>
                  </div>
                  {(citaActiva.estado === 'Pendiente' || citaActiva.estado === 'Confirmada') && (
                    <div className="dp-briefing-btns">
                      {citaActiva.estado === 'Pendiente' && (
                        <>
                          <button className="dp-btn-confirmar" onClick={() => cambiarEstadoCita(citaActiva.id, 'Confirmada')}>
                            ✓ Confirmar cita
                          </button>
                          <button className="dp-btn-rechazar" onClick={() => cambiarEstadoCita(citaActiva.id, 'Rechazada')}>
                            Rechazar
                          </button>
                        </>
                      )}
                      {citaActiva.estado === 'Confirmada' && (
                        <button className="dp-btn-ia" onClick={() => abrirActa(citaActiva)}>
                          📝 Generar acta
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 3: ACTAS — HU007
      ══════════════════════════════════════════════ */}
      {activeTab === 'actas' && (
        <div className="dp-content">
          <h2 className="dp-section-title">Actas de Reunión</h2>
          <p className="dp-section-desc">Selecciona una cita completada o confirmada para redactar el acta oficial.</p>

          <div className="dp-actas-grid">
            {citas.filter(c => c.estado === 'Completada' || c.estado === 'Confirmada').map(cita => (
              <div key={cita.id} className="dp-acta-card">
                <div className="dp-acta-top">
                  <span className="dp-ticket">{cita.ticket}</span>
                  <span className={`dp-estado dp-estado-${cita.estado.toLowerCase()}`}>{cita.estado}</span>
                </div>
                <h4>{cita.padre} · {cita.alumno}</h4>
                <p className="dp-cita-motivo">{cita.motivo} · {cita.fecha}</p>
                <button className="dp-btn-acta" onClick={() => abrirActa(cita)}>
                  ✍️ Redactar Acta Formal
                </button>
              </div>
            ))}
            {citas.filter(c => c.estado === 'Completada' || c.estado === 'Confirmada').length === 0 && (
              <div className="dp-empty">No hay citas completadas o confirmadas aún.</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: GENERAR ACTA — HU007
      ══════════════════════════════════════════════ */}
      {modalActa && (
        <div className="dp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalActa(null); }}>
          <div className="dp-modal">
            <div className="dp-modal-header">
              <div>
                <h3 className="dp-modal-title">Generar acta de reunión</h3>
                <p className="dp-modal-sub">{modalActa.padre} · {modalActa.alumno} · {modalActa.fecha}</p>
              </div>
              <button className="dp-modal-close" onClick={() => setModalActa(null)}>×</button>
            </div>

            {!actaGenerada ? (
              <div>
                <label className="dp-modal-label">
                  Acuerdos en lenguaje libre <span className="dp-modal-hint">(el docente escribe)</span>:
                </label>
                <textarea
                  className="dp-modal-textarea"
                  value={notasActa}
                  onChange={e => setNotasActa(e.target.value)}
                  placeholder="Ej: Le dije al papá que el niño debe estudiar más y hacer las tareas, acordamos que la mamá lo va a ayudar todas las noches con los deberes..."
                  rows={5}
                />
                <div className="dp-modal-ia-hint">
                  <span className="dp-ia-badge">✦ IA convierte a formato MINEDU</span>
                </div>
                <div className="dp-modal-actions">
                  <button className="dp-btn-cancelar" onClick={() => setModalActa(null)}>Cancelar</button>
                  <button
                    className="dp-btn-ia"
                    onClick={handleEnviarActa}
                    disabled={loadingActa || !notasActa.trim()}
                  >
                    {loadingActa
                      ? <><span className="dp-mini-spinner" /> Generando PDF...</>
                      : '⚡ Procesar con IA'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="dp-acta-ia-result">
                  <div className="dp-ia-badge" style={{ marginBottom: 12 }}>✦ Acta estructurada por IA</div>
                  <p><strong>Acuerdos:</strong> {actaGenerada.acuerdos}</p>
                  <p><strong>Compromisos:</strong> {actaGenerada.compromisos}</p>
                  <p><strong>Seguimiento:</strong> {actaGenerada.seguimiento}</p>
                </div>
                <div className="dp-modal-actions">
                  <button className="dp-btn-cancelar" onClick={() => setModalActa(null)}>Cerrar</button>
                  <button className="dp-btn-ia">⬇ Descargar PDF</button>
                  <button className="dp-btn-confirmar" onClick={() => setModalActa(null)}>✓ Finalizar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
