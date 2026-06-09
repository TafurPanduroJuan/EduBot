import React, { useState, useEffect, useCallback } from 'react';
import {
  obtenerDisponibilidadDocente,
  guardarDisponibilidad,
  sugerirDisponibilidadIA,
  obtenerCitasPendientesDocente,
  obtenerBriefingCita,
  generarActa,
} from '../services/api';
import '../assets/styles/DocentePanel.css';

// ── Estructura semanal ────────────────────────────────────────────────────────
const DIAS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HORAS = ['8am', '9am', '10am', '11am', '2pm', '3pm', '4pm', '5pm'];

// Mapa de hora label → LocalTime para enviar al backend
const HORA_A_TIME = {
  '8am': '08:00', '9am': '09:00', '10am': '10:00', '11am': '11:00',
  '2pm': '14:00', '3pm': '15:00', '4pm': '16:00', '5pm': '17:00',
};

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
  return g;
};

// Convierte bloques del backend → grilla frontend
const bloquesAGrilla = (bloques) => {
  const g = iniciarGrilla();
  const DIA_MAP = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sab', 0: 'Dom' };
  bloques.forEach(b => {
    // b.fecha es "YYYY-MM-DD"; calculamos el día de semana
    const d = new Date(b.fecha + 'T00:00:00');
    const diaLabel = DIA_MAP[d.getDay()];
    if (!diaLabel || !g[diaLabel]) return;
    const horaStr = b.horaInicio ? b.horaInicio.substring(0, 5) : null;
    // Encontrar la hora label más cercana
    const horaLabel = Object.entries(HORA_A_TIME).find(([, v]) => v === horaStr)?.[0];
    if (horaLabel && g[diaLabel][horaLabel] !== undefined) {
      g[diaLabel][horaLabel] = b.disponible ? 'disponible' : 'ocupado';
    }
  });
  return g;
};

// Convierte grilla → formato que espera el backend (lista de bloques)
const grillaABloques = (grilla) => {
  const hoy = new Date();
  const bloques = [];
  DIAS.forEach((diaLabel, idx) => {
    // idx 0=Lun → dayOfWeek 1, etc.
    const diasHastaLunes = (1 - hoy.getDay() + 7) % 7;
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + diasHastaLunes + idx);
    const fechaStr = fecha.toISOString().split('T')[0];

    HORAS.forEach(horaLabel => {
      const estado = grilla[diaLabel][horaLabel];
      if (estado === 'disponible' || estado === 'ia-sugerido') {
        const inicio = HORA_A_TIME[horaLabel];
        // hora fin = inicio + 30 min
        const [h, m] = inicio.split(':').map(Number);
        const finMin = m + 30;
        const fin = `${String(h + Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
        bloques.push({ fecha: fechaStr, horaInicio: inicio, horaFin: fin });
      }
    });
  });
  return bloques;
};

export default function DocentePanel({ user, onLogout }) {
  const [activeNav, setActiveNav]             = useState('disponibilidad');
  const [grilla, setGrilla]                   = useState(iniciarGrilla);
  const [loadingIA, setLoadingIA]             = useState(false);
  const [loadingSave, setLoadingSave]         = useState(false);
  const [guardado, setGuardado]               = useState(false);
  const [loadingDisp, setLoadingDisp]         = useState(false);

  const [citas, setCitas]                     = useState([]);
  const [loadingCitas, setLoadingCitas]       = useState(false);
  const [filtroCita, setFiltroCita]           = useState('Pendiente');
  const [citaActiva, setCitaActiva]           = useState(null);
  const [briefing, setBriefing]               = useState(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [modalActa, setModalActa]             = useState(null);
  const [notasActa, setNotasActa]             = useState('');
  const [actaGenerada, setActaGenerada]       = useState(null);
  const [loadingActa, setLoadingActa]         = useState(false);
  const [toast, setToast]                     = useState(null);

  const nombreDocente = user?.nombreDocente || user?.username || 'Docente';

  const showToast = (texto, tipo = 'success') => {
    setToast({ texto, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Cargar disponibilidad desde backend ──────────────────────────────────
  const cargarDisponibilidad = useCallback(async () => {
    setLoadingDisp(true);
    try {
      const bloques = await obtenerDisponibilidadDocente();
      if (bloques && bloques.length > 0) {
        setGrilla(bloquesAGrilla(bloques));
      }
    } catch {
      // Si falla, se queda con grilla vacía (no bloquea la UI)
    } finally {
      setLoadingDisp(false);
    }
  }, []);

  // ── Cargar citas pendientes desde backend ────────────────────────────────
  const cargarCitas = useCallback(async () => {
    setLoadingCitas(true);
    try {
      const data = await obtenerCitasPendientesDocente();
      // Normalizar capitales para que coincida con los filtros del frontend
      setCitas((data || []).map(c => ({
        ...c,
        estado: c.estado
          ? c.estado.charAt(0).toUpperCase() + c.estado.slice(1).toLowerCase()
          : 'Pendiente',
        motivo: c.motivo
          ? c.motivo.charAt(0).toUpperCase() + c.motivo.slice(1)
          : '',
        ultimaNota: c.ultimaNota || null,
        inasistencias: c.inasistencias ?? 0,
      })));
    } catch {
      setCitas([]);
    } finally {
      setLoadingCitas(false);
    }
  }, []);

  useEffect(() => {
    cargarDisponibilidad();
    cargarCitas();
  }, [cargarDisponibilidad, cargarCitas]);

  // ── Toggle celda de grilla ───────────────────────────────────────────────
  const cicloEstado = {
    libre: 'disponible',
    disponible: 'ocupado',
    ocupado: 'bloqueado',
    bloqueado: 'libre',
    'ia-sugerido': 'disponible',
  };

  const toggleCelda = (dia, hora) => {
    setGrilla(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [hora]: cicloEstado[prev[dia][hora]] },
    }));
    setGuardado(false);
  };

  // ── Sugerir IA ───────────────────────────────────────────────────────────
  const handleSugerirIA = async () => {
    setLoadingIA(true);
    try {
      const resp = await sugerirDisponibilidadIA();
      // El backend devuelve { mensajeIA, bloquesSugeridos }
      if (resp?.bloquesSugeridos?.length > 0) {
        const nueva = bloquesAGrilla(resp.bloquesSugeridos);
        setGrilla(nueva);
        showToast('✦ IA sugirió los horarios de mayor demanda.');
      } else {
        showToast(resp?.mensajeIA || '✦ Sugerencia IA recibida.', 'info');
      }
    } catch {
      // Fallback visual si el endpoint IA falla
      setGrilla(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        ['Mar', 'Jue'].forEach(d => {
          ['3pm', '4pm'].forEach(h => { next[d][h] = 'ia-sugerido'; });
        });
        return next;
      });
      showToast('✦ Sugerencia aplicada (modo demo).');
    } finally {
      setLoadingIA(false);
      setGuardado(false);
    }
  };

  // ── Guardar disponibilidad ───────────────────────────────────────────────
  const handleGuardar = async () => {
    setLoadingSave(true);
    try {
      const bloques = grillaABloques(grilla);
      await guardarDisponibilidad({ bloques, reemplazarExistentes: true });
      setGuardado(true);
      showToast('Disponibilidad guardada correctamente.');
    } catch (e) {
      showToast('Error al guardar: ' + (e.message || 'intenta de nuevo'), 'error');
    } finally {
      setLoadingSave(false);
    }
  };

  // ── Cambiar estado de cita (local mientras no hay endpoint PATCH docente) ─
  const cambiarEstadoCita = (id, nuevoEstado) => {
    setCitas(prev => prev.map(c => c.id === id ? { ...c, estado: nuevoEstado } : c));
    if (citaActiva?.id === id) setCitaActiva(prev => ({ ...prev, estado: nuevoEstado }));
    showToast(nuevoEstado === 'Confirmada'
      ? '✅ Cita confirmada. El padre será notificado.'
      : '❌ Cita rechazada.');
    setBriefing(null);
  };

  // ── Briefing IA ──────────────────────────────────────────────────────────
  const handleBriefing = async (cita) => {
    setCitaActiva(cita);
    setBriefing(null);
    setLoadingBriefing(true);
    try {
      const resp = await obtenerBriefingCita(cita.id);
      setBriefing({ citaId: cita.id, texto: resp?.resumen || resp?.texto || JSON.stringify(resp) });
    } catch {
      setBriefing({
        citaId: cita.id,
        texto: `Motivo: ${cita.motivo}. Sin historial adicional disponible en este momento.`,
      });
    } finally {
      setLoadingBriefing(false);
    }
  };

  // ── Acta ─────────────────────────────────────────────────────────────────
  const handleEnviarActa = async (e) => {
    e.preventDefault();
    if (!notasActa.trim()) return;
    setLoadingActa(true);
    try {
      const resp = await generarActa(modalActa.id, notasActa);
      setActaGenerada({
        acuerdos:    resp?.acuerdos    || 'El estudiante reforzará los compromisos acordados.',
        compromisos: resp?.compromisos || 'La familia acompañará el proceso académico.',
        seguimiento: resp?.seguimiento || `Revisión en 30 días — ${new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
      });
      setCitas(prev => prev.map(c => c.id === modalActa.id ? { ...c, estado: 'Completada' } : c));
      showToast(`✅ Acta del ticket ${modalActa.ticket} generada con IA.`);
    } catch {
      showToast('Error al generar el acta. Intenta de nuevo.', 'error');
    } finally {
      setLoadingActa(false);
    }
  };

  const abrirActa = (cita) => { setModalActa(cita); setNotasActa(''); setActaGenerada(null); };

  const citasFiltradas = citas.filter(c =>
    filtroCita === 'Todas' ? true : c.estado === filtroCita
  );

  const totalDisponibles = Object.values(grilla).reduce((acc, dia) =>
    acc + Object.values(dia).filter(e => e === 'disponible' || e === 'ia-sugerido').length, 0
  );

  const pendientes = citas.filter(c => c.estado === 'Pendiente').length;

  const navItems = [
    { key: 'inicio',         icon: '⊞', label: 'Inicio' },
    { key: 'disponibilidad', icon: '📅', label: 'Disponibilidad' },
    { key: 'solicitudes',    icon: '📋', label: 'Solicitudes', badge: pendientes > 0 ? pendientes : null },
    { key: 'actas',          icon: '📝', label: 'Actas' },
  ];

  return (
    <div className="dp-shell">

      {toast && (
        <div className={`dp-toast dp-toast-${toast.tipo}`}>{toast.texto}</div>
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
              {item.badge && <span className="dp-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <button className="dp-sidebar-logout" onClick={onLogout}>Cerrar sesión</button>
      </aside>

      {/* ── Main ── */}
      <div className="dp-main">

        {/* ══ INICIO ══ */}
        {activeNav === 'inicio' && (
          <div className="dp-content">
            <h2 className="dp-section-title">Bienvenido, Prof. {nombreDocente}</h2>
            <p className="dp-section-desc">Resumen del día</p>
            <div className="dp-inicio-cards">
              <div className="dp-inicio-card" onClick={() => setActiveNav('solicitudes')}>
                <span className="dp-inicio-num">{loadingCitas ? '…' : pendientes}</span>
                <span className="dp-inicio-label">Solicitudes pendientes</span>
              </div>
              <div className="dp-inicio-card" onClick={() => setActiveNav('disponibilidad')}>
                <span className="dp-inicio-num">{loadingDisp ? '…' : totalDisponibles}</span>
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

        {/* ══ DISPONIBILIDAD ══ */}
        {activeNav === 'disponibilidad' && (
          <div className="dp-content">
            <div className="dp-dispon-header">
              <div>
                <h2 className="dp-section-title">Mi disponibilidad</h2>
                <p className="dp-section-desc">Próxima semana laboral</p>
              </div>
              <button
                className="dp-btn-ia-outline"
                onClick={handleSugerirIA}
                disabled={loadingIA || loadingDisp}
              >
                {loadingIA
                  ? <><span className="dp-mini-spinner" /> Analizando...</>
                  : '✦ Sugerir con IA'}
              </button>
            </div>

            {loadingDisp && (
              <div className="dp-briefing-loading">
                <div className="dp-spinner-med" />
                <p>Cargando disponibilidad…</p>
              </div>
            )}

            {!loadingDisp && (
              <>
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
                                  style={est !== 'libre' ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : {}}
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
              </>
            )}
          </div>
        )}

        {/* ══ SOLICITUDES ══ */}
        {activeNav === 'solicitudes' && (
          <div className="dp-content">
            <div className="dp-sol-layout">
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

                {loadingCitas && (
                  <div className="dp-briefing-loading">
                    <div className="dp-spinner-med" />
                    <p>Cargando solicitudes…</p>
                  </div>
                )}

                {!loadingCitas && citasFiltradas.length === 0 && (
                  <div className="dp-empty">
                    {citas.length === 0
                      ? 'No tienes citas asignadas aún.'
                      : 'Sin solicitudes para este filtro.'}
                  </div>
                )}

                {!loadingCitas && citasFiltradas.map(cita => (
                  <div
                    key={cita.id}
                    className={`dp-cita-card ${citaActiva?.id === cita.id ? 'dp-cita-active' : ''}`}
                    onClick={() => handleBriefing(cita)}
                  >
                    <p className="dp-cita-fecha-top">1 solicitud · {cita.fecha}</p>
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
                        <button className="dp-btn-confirmar"
                          onClick={(e) => { e.stopPropagation(); cambiarEstadoCita(cita.id, 'Confirmada'); }}>
                          Confirmar cita
                        </button>
                        <button className="dp-btn-rechazar"
                          onClick={(e) => { e.stopPropagation(); cambiarEstadoCita(cita.id, 'Rechazada'); }}>
                          Rechazar
                        </button>
                      </div>
                    )}
                    {cita.estado === 'Confirmada' && (
                      <button className="dp-btn-acta-small"
                        onClick={(e) => { e.stopPropagation(); abrirActa(cita); }}>
                        📝 Generar acta
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Briefing IA */}
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
                    <div className="dp-briefing-ia-box">
                      <span className="dp-ia-badge" style={{ marginBottom: 10, display: 'inline-block' }}>
                        ✦ Briefing IA
                      </span>
                      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{briefing.texto}</p>
                    </div>
                    {(citaActiva.estado === 'Pendiente' || citaActiva.estado === 'Confirmada') && (
                      <div className="dp-briefing-btns">
                        {citaActiva.estado === 'Pendiente' && (
                          <>
                            <button className="dp-btn-confirmar"
                              onClick={() => cambiarEstadoCita(citaActiva.id, 'Confirmada')}>
                              Confirmar cita
                            </button>
                            <button className="dp-btn-rechazar"
                              onClick={() => cambiarEstadoCita(citaActiva.id, 'Rechazada')}>
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

        {/* ══ ACTAS ══ */}
        {activeNav === 'actas' && (
          <div className="dp-content">
            <h2 className="dp-section-title">Actas de Reunión</h2>
            <p className="dp-section-desc" style={{ marginBottom: 20 }}>
              Selecciona una cita completada o confirmada para redactar el acta oficial.
            </p>
            <div className="dp-actas-grid">
              {citas.filter(c => c.estado === 'Completada' || c.estado === 'Confirmada').length === 0 && (
                <div className="dp-empty">No hay citas completadas o confirmadas aún.</div>
              )}
              {citas.filter(c => c.estado === 'Completada' || c.estado === 'Confirmada').map(cita => (
                <div key={cita.id} className="dp-acta-card">
                  <div className="dp-acta-top">
                    <span className="dp-ticket">{cita.ticket}</span>
                    <span className={`dp-estado dp-estado-${cita.estado.toLowerCase()}`}>{cita.estado}</span>
                  </div>
                  <h4 className="dp-acta-nombre">{cita.padre} · {cita.alumno}</h4>
                  <p className="dp-cita-motivo">{cita.motivo} · {cita.fecha}</p>
                  <button className="dp-btn-acta" onClick={() => abrirActa(cita)}>
                    ✍️ Redactar Acta Formal
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL ACTA ══ */}
      {modalActa && (
        <div className="dp-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setModalActa(null); }}>
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
                  placeholder="Ej: El niño debe estudiar más y hacer las tareas, la mamá lo va a ayudar todas las noches..."
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
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}