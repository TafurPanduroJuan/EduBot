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
  'disponible':  { bg: '#e8f5ee', color: '#1a6b3c', label: 'Activo'      },
  'ocupado':     { bg: '#fff0f2', color: '#7B1F3A', label: 'Ocupado'     },
  'ia-sugerido': { bg: '#7B1F3A', color: '#fff',    label: 'IA sugerido' },
  'bloqueado':   { bg: '#f0f0f8', color: '#888',    label: 'Bloqueado'   },
  'libre':       { bg: '#ffffff', color: '#ccc',    label: ''            },
};

const iniciarGrilla = () => {
  const g = {};
  DIAS.forEach(d => {
    g[d] = {};
    HORAS.forEach(h => { g[d][h] = 'libre'; });
  });
  // Precargados como en mockup HU004: Mar y Jue con IA sugerido
  g['Mar']['3pm'] = 'ia-sugerido';
  g['Mar']['4pm'] = 'ia-sugerido';
  g['Jue']['3pm'] = 'ia-sugerido';
  g['Jue']['4pm'] = 'ia-sugerido';
  // Algunos días activos
  g['Lun']['3pm'] = 'disponible';
  g['Lun']['4pm'] = 'disponible';
  g['Mié']['3pm'] = 'disponible';
  g['Mié']['4pm'] = 'disponible';
  g['Vie']['3pm'] = 'disponible';
  return g;
};

const iniciarCitas = () => {
  const hoy = new Date();
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
  const fmt = d => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  return [
    { id: 1, ticket: 'EDU-3421', padre: 'Rosa Mamani', alumno: 'Juan Mamani', grado: '3er A',
      motivo: 'Rendimiento Académico', fecha: fmt(hoy), hora: '10:00',
      estado: 'Pendiente', ultimaNota: '08/20 en Comunicación', inasistencias: 2 },
    { id: 2, ticket: 'EDU-3425', padre: 'Carlos García', alumno: 'Luis García', grado: '2do B',
      motivo: 'Conducta y Disciplina', fecha: fmt(manana), hora: '14:30',
      estado: 'Pendiente', ultimaNota: '12/20 en Matemáticas', inasistencias: 0 },
    { id: 3, ticket: 'EDU-3510', padre: 'María Flores', alumno: 'Ana Flores', grado: '4to A',
      motivo: 'Orientación Vocacional', fecha: fmt(manana), hora: '16:00',
      estado: 'Confirmada', ultimaNota: '15/20 en Ciencias', inasistencias: 1 },
    { id: 4, ticket: 'EDU-3418', padre: 'Pedro Silva', alumno: 'Carla Silva', grado: '3er A',
      motivo: 'Rendimiento Académico', fecha: '5 Mar', hora: '09:00',
      estado: 'Completada', ultimaNota: '10/20 en Comunicación', inasistencias: 3 },
  ];
};

export default function DocentePanel({ user, onLogout }) {
  const [activeNav, setActiveNav]         = useState('disponibilidad');
  const [grilla, setGrilla]               = useState(iniciarGrilla);
  const [loadingIA, setLoadingIA]         = useState(false);
  const [loadingSave, setLoadingSave]     = useState(false);
  const [guardado, setGuardado]           = useState(false);
  const [citas, setCitas]                 = useState(iniciarCitas);
  const [filtroCita, setFiltroCita]       = useState('Pendiente');
  const [citaActiva, setCitaActiva]       = useState(null);
  const [briefing, setBriefing]           = useState(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [modalActa, setModalActa]         = useState(null);
  const [notasActa, setNotasActa]         = useState('');
  const [actaGenerada, setActaGenerada]   = useState(null);
  const [loadingActa, setLoadingActa]     = useState(false);
  const [toast, setToast]                 = useState(null);

  const nombreDocente = user?.nombreDocente || user?.username || 'Ricardo F.';

  const showToast = (texto, tipo = 'success') => {
    setToast({ texto, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const cicloEstado = {
    libre: 'disponible',
    disponible: 'ocupado',
    ocupado: 'bloqueado',
    bloqueado: 'libre',
    'ia-sugerido': 'disponible'
  };

  const toggleCelda = (dia, hora) => {
    setGrilla(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [hora]: cicloEstado[prev[dia][hora]] }
    }));
    setGuardado(false);
  };

  const handleSugerirIA = async () => {
    setLoadingIA(true);
    await new Promise(r => setTimeout(r, 1200));
    setGrilla(prev => {
      const next = { ...prev };
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

  const handleGuardar = async () => {
    setLoadingSave(true);
    try { await guardarDisponibilidad(grilla); } catch (_) {}
    await new Promise(r => setTimeout(r, 800));
    setLoadingSave(false);
    setGuardado(true);
    showToast('Disponibilidad guardada correctamente.');
  };

  const cambiarEstadoCita = (id, nuevoEstado) => {
    setCitas(prev => prev.map(c => c.id === id ? { ...c, estado: nuevoEstado } : c));
    if (citaActiva?.id === id) setCitaActiva(prev => ({ ...prev, estado: nuevoEstado }));
    showToast(nuevoEstado === 'Confirmada' ? '✅ Cita confirmada. El padre será notificado.' : '❌ Cita rechazada.');
    setBriefing(null);
  };

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

  const handleEnviarActa = async (e) => {
    e.preventDefault();
    if (!notasActa.trim()) return;
    setLoadingActa(true);
    try { await generarActa(modalActa.id, notasActa); } catch (_) {}
    await new Promise(r => setTimeout(r, 1200));
    setActaGenerada({
      acuerdos: 'El estudiante reforzará hábitos de estudio diariamente.',
      compromisos: 'La madre acompañará las actividades académicas cada noche.',
      seguimiento: `Revisión en 30 días — ${new Date(Date.now() + 30*24*3600*1000).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}.`
    });
    setCitas(prev => prev.map(c => c.id === modalActa.id ? { ...c, estado: 'Completada' } : c));
    setLoadingActa(false);
    showToast(`✅ Acta del ticket ${modalActa.ticket} generada con IA.`);
  };

  const abrirActa = (cita) => { setModalActa(cita); setNotasActa(''); setActaGenerada(null); };
  const citasFiltradas = citas.filter(c => filtroCita === 'Todas' ? true : c.estado === filtroCita);

  const totalDisponibles = Object.values(grilla).reduce((acc, dia) =>
    acc + Object.values(dia).filter(e => e === 'disponible' || e === 'ia-sugerido').length, 0);

  const pendientes = citas.filter(c => c.estado === 'Pendiente').length;

  // ── Nav items — como mockup sidebar ──
  const navItems = [
    { key: 'inicio',          icon: '⊞', label: 'Inicio'         },
    { key: 'disponibilidad',  icon: '📅', label: 'Disponibilidad' },
    { key: 'solicitudes',     icon: '📋', label: 'Solicitudes',   badge: pendientes > 0 ? pendientes : null },
    { key: 'actas',           icon: '📝', label: 'Actas'          },
  ];

  return (
    <div className="dp-shell">

      {/* Toast */}
      {toast && (
        <div className={`dp-toast dp-toast-${toast.tipo}`}>
          {toast.texto}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="dp-sidebar">
        <div className="dp-sidebar-top">
          <div className="dp-sidebar-avatar">P</div>
          <div className="dp-sidebar-brand">
            <span className="dp-sidebar-role">Panel Docente</span>
            <span className="dp-sidebar-name">Prof. {nombreDocente}</span>
          </div>
        </div>

        <nav className="dp-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`dp-nav-item ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => setActiveNav(item.key)}
            >
              <span className="dp-nav-icon">{item.icon}</span>
              <span className="dp-nav-label">{item.label}</span>
              {item.badge && (
                <span className="dp-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <button className="dp-sidebar-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </aside>

      {/* ── Main Content ── */}
      <div className="dp-main">

        {/* ══ INICIO ══ */}
        {activeNav === 'inicio' && (
          <div className="dp-content">
            <h2 className="dp-section-title">Bienvenido, Prof. {nombreDocente}</h2>
            <p className="dp-section-desc">Resumen del día</p>
            <div className="dp-inicio-cards">
              <div className="dp-inicio-card" onClick={() => setActiveNav('solicitudes')}>
                <span className="dp-inicio-num">{pendientes}</span>
                <span className="dp-inicio-label">Solicitudes pendientes</span>
              </div>
              <div className="dp-inicio-card" onClick={() => setActiveNav('disponibilidad')}>
                <span className="dp-inicio-num">{totalDisponibles}</span>
                <span className="dp-inicio-label">Bloques disponibles</span>
              </div>
              <div className="dp-inicio-card" onClick={() => setActiveNav('actas')}>
                <span className="dp-inicio-num">
                  {citas.filter(c => c.estado === 'Completada').length}
                </span>
                <span className="dp-inicio-label">Actas generadas</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ DISPONIBILIDAD — HU004 ══ */}
        {activeNav === 'disponibilidad' && (
          <div className="dp-content">

            {/* Encabezado + botón IA como mockup */}
            <div className="dp-dispon-header">
              <div>
                <h2 className="dp-section-title">Mi disponibilidad</h2>
                <p className="dp-section-desc">
                  Semana 9–13 Mar 2026
                </p>
              </div>
              <button
                className="dp-btn-ia-outline"
                onClick={handleSugerirIA}
                disabled={loadingIA}
              >
                {loadingIA
                  ? <><span className="dp-mini-spinner" /> Analizando...</>
                  : '✦ Sugerir con IA'}
              </button>
            </div>

            {/* Grilla de disponibilidad */}
            <div className="dp-grilla-wrap">
              <table className="dp-grilla">
                <thead>
                  <tr>
                    <th className="dp-grilla-th-hora"></th>
                    {DIAS.map(d => (
                      <th key={d} className="dp-grilla-th-dia">{d}</th>
                    ))}
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
                          <td key={dia} className="dp-grilla-td">
                            <button
                              className={`dp-celda ${est !== 'libre' ? 'dp-celda-filled' : ''} dp-celda-${est}`}
                              style={
                                est !== 'libre'
                                  ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color }
                                  : {}
                              }
                              onClick={() => toggleCelda(dia, hora)}
                              title={`${dia} ${hora} — ${cfg.label || 'Libre'}`}
                            >
                              {est === 'ia-sugerido' && <span className="dp-celda-ia-label">✦</span>}
                              {est === 'disponible'  && <span>✓</span>}
                              {est === 'ocupado'     && <span>●</span>}
                              {est === 'bloqueado'   && <span>✕</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Leyenda + guardar */}
            <div className="dp-grilla-footer">
              <div className="dp-leyenda">
                <span className="dp-leyenda-item">
                  <span className="dp-leyenda-dot" style={{ background: '#7B1F3A' }} /> IA sugerido
                </span>
                <span className="dp-leyenda-item">
                  <span className="dp-leyenda-dot" style={{ background: '#1a6b3c' }} /> Activo
                </span>
                <span className="dp-leyenda-item">
                  <span className="dp-leyenda-dot" style={{ background: '#e5e7ef' }} /> Bloqueado
                </span>
              </div>
              <button
                className="dp-btn-guardar"
                onClick={handleGuardar}
                disabled={loadingSave || guardado}
              >
                {loadingSave ? 'Guardando...' : guardado ? '✓ Guardado' : '📅 Guardar disponibilidad'}
              </button>
            </div>
          </div>
        )}

        {/* ══ SOLICITUDES — HU005 + HU006 ══ */}
        {activeNav === 'solicitudes' && (
          <div className="dp-content">
            <div className="dp-sol-layout">

              {/* Lista de solicitudes */}
              <div className="dp-sol-lista">
                <h2 className="dp-section-title" style={{ marginBottom: 14 }}>Solicitudes pendientes</h2>

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
                    {/* Fecha encabezado como mockup HU006 */}
                    <p className="dp-cita-fecha-top">
                      1 nueva solicitud · {cita.fecha}
                    </p>

                    <div className="dp-cita-top">
                      <div>
                        <h4 className="dp-cita-padre">{cita.padre}</h4>
                        <p className="dp-cita-alumno">Est: {cita.alumno} · {cita.grado}</p>
                        <p className="dp-cita-motivo">{cita.motivo}</p>
                      </div>
                      <span className={`dp-estado dp-estado-${cita.estado.toLowerCase()}`}>
                        {cita.estado}
                      </span>
                    </div>

                    <div className="dp-cita-datetime">
                      <span>📅 {cita.fecha} · {cita.hora}</span>
                      <span className="dp-ticket">{cita.ticket}</span>
                    </div>

                    {cita.estado === 'Pendiente' && (
                      <div className="dp-cita-acciones">
                        <button
                          className="dp-btn-confirmar"
                          onClick={(e) => { e.stopPropagation(); cambiarEstadoCita(cita.id, 'Confirmada'); }}
                        >
                          Confirmar cita
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

              {/* Briefing IA — como mockup HU006 */}
              <div className="dp-briefing-aside">
                <div className="dp-briefing-header">
                  <span className="dp-ia-badge">✦ Briefing IA generado automáticamente</span>
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
                      <strong>{citaActiva.padre}</strong>
                      <span className="dp-briefing-sep">·</span>
                      Est: {citaActiva.alumno}
                      <span className="dp-briefing-grado">{citaActiva.grado}</span>
                    </div>
                    <p className="dp-briefing-motivo">
                      {citaActiva.motivo} · {citaActiva.fecha} · {citaActiva.hora}
                    </p>

                    {/* Briefing box IA */}
                    <div className="dp-briefing-ia-box">
                      <span className="dp-ia-badge" style={{ marginBottom: 10, display: 'inline-block' }}>
                        ✦ Briefing IA generado automáticamente
                      </span>
                      <ul className="dp-briefing-list">
                        <li>· Última nota: <strong>{citaActiva.ultimaNota}</strong> <span className="dp-nota-baja">(baja)</span></li>
                        <li>· {citaActiva.inasistencias} inasistencia{citaActiva.inasistencias !== 1 ? 's' : ''} en las últimas 2 semanas</li>
                        <li>· Sugerencia: revisar comprensión lectora y hábitos de estudio</li>
                      </ul>
                    </div>

                    {(citaActiva.estado === 'Pendiente' || citaActiva.estado === 'Confirmada') && (
                      <div className="dp-briefing-btns">
                        {citaActiva.estado === 'Pendiente' && (
                          <>
                            <button
                              className="dp-btn-confirmar"
                              onClick={() => cambiarEstadoCita(citaActiva.id, 'Confirmada')}
                            >
                              Confirmar cita
                            </button>
                            <button
                              className="dp-btn-rechazar"
                              onClick={() => cambiarEstadoCita(citaActiva.id, 'Rechazada')}
                            >
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

        {/* ══ ACTAS — HU007 ══ */}
        {activeNav === 'actas' && (
          <div className="dp-content">
            <h2 className="dp-section-title">Actas de Reunión</h2>
            <p className="dp-section-desc" style={{ marginBottom: 20 }}>
              Selecciona una cita completada o confirmada para redactar el acta oficial.
            </p>
            <div className="dp-actas-grid">
              {citas.filter(c => c.estado === 'Completada' || c.estado === 'Confirmada').map(cita => (
                <div key={cita.id} className="dp-acta-card">
                  <div className="dp-acta-top">
                    <span className="dp-ticket">{cita.ticket}</span>
                    <span className={`dp-estado dp-estado-${cita.estado.toLowerCase()}`}>
                      {cita.estado}
                    </span>
                  </div>
                  <h4 className="dp-acta-nombre">{cita.padre} · {cita.alumno}</h4>
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
      </div>

      {/* ══ MODAL ACTA — HU007 ══ */}
      {modalActa && (
        <div
          className="dp-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setModalActa(null); }}
        >
          <div className="dp-modal">
            <div className="dp-modal-header">
              <div>
                <h3 className="dp-modal-title">Generar acta de reunión</h3>
                <p className="dp-modal-sub">
                  {modalActa.padre} · {modalActa.alumno} · {modalActa.fecha} · {modalActa.hora}
                </p>
              </div>
              <button className="dp-modal-close" onClick={() => setModalActa(null)}>×</button>
            </div>

            {!actaGenerada ? (
              <div>
                <label className="dp-modal-label">
                  Acuerdos en lenguaje libre{' '}
                  <span className="dp-modal-hint">(el docente escribe):</span>
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
                  <button className="dp-btn-cancelar" onClick={() => setModalActa(null)}>
                    Cancelar
                  </button>
                  <button
                    className="dp-btn-ia"
                    onClick={handleEnviarActa}
                    disabled={loadingActa || !notasActa.trim()}
                  >
                    {loadingActa
                      ? <><span className="dp-mini-spinner" /> Generando...</>
                      : '⚡ Procesar con IA'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="dp-acta-ia-result">
                  <span className="dp-ia-badge" style={{ marginBottom: 12, display: 'inline-block' }}>
                    ✦ Acta estructurada por IA
                  </span>
                  <p><strong>Acuerdos:</strong> {actaGenerada.acuerdos}</p>
                  <p><strong>Compromisos:</strong> {actaGenerada.compromisos}</p>
                  <p><strong>Seguimiento:</strong> {actaGenerada.seguimiento}</p>
                </div>
                <div className="dp-modal-actions">
                  <button className="dp-btn-cancelar" onClick={() => setModalActa(null)}>Cerrar</button>
                  <button className="dp-btn-ia">⬇ Descargar PDF</button>
                  <button className="dp-btn-ia dp-btn-editar">✏️ Editar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
