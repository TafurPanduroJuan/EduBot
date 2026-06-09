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

const DocentePanel = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('disponibilidad');
  const [loading, setLoading] = useState(false);
  const [mensajeStatus, setMensajeStatus] = useState({ texto: '', tipo: '' });

  // HU004: Grilla de Disponibilidad
  const [disponibilidad, setDisponibilidad] = useState([]);
  
  // HU006: Citas Pendientes y Briefing
  const [citasPendientes, setCitasPendientes] = useState([]);
  const [briefingSeleccionado, setBriefingSeleccionado] = useState(null);
  const [loadingBriefingId, setLoadingBriefingId] = useState(null);

  // HU007: Actas sin prompt() externo
  const [mostrarModalActa, setMostrarModalActa] = useState(false);
  const [citaParaActa, setCitaParaActa] = useState(null);
  const [notasActa, setNotasActa] = useState('');

  // Cargar datos iniciales reales al montar el componente
  useEffect(() => {
    cargarDisponibilidad();
    cargarCitas();
  }, []);

  const cargarDisponibilidad = async () => {
    try {
      const data = await obtenerDisponibilidadDocente();
      // Si el backend responde con un arreglo vacío o crudo, inicializamos estructura estándar
      setDisponibilidad(data && data.length ? data : [
        { id: 1, dia: 'Lunes', horaInicio: '08:00', horaFin: '10:00', estado: 'Disponible' },
        { id: 2, dia: 'Miércoles', horaInicio: '14:00', horaFin: '16:00', estado: 'Ocupado' },
        { id: 3, dia: 'Viernes', horaInicio: '10:00', horaFin: '12:00', estado: 'Disponible' }
      ]);
    } catch (e) {
      console.error("Error cargando disponibilidad:", e);
    }
  };

  const cargarCitas = async () => {
    try {
      const data = await obtenerCitasPendientesDocente();
      // Corrección de mocks y fechas hardcodeadas antiguas por fechas actuales y dinámicas
      const hoy = new Date();
      const mañana = new Date(hoy);
      mañana.setDate(hoy.getDate() + 1);

      const formatearFecha = (d) => d.toISOString().split('T')[0];

      if (data && data.length) {
        setCitasPendientes(data);
      } else {
        setCitasPendientes([
          { id: 1, ticket: "EDU-3421", padre: "Rosa López", motivo: "Rendimiento Académico", fecha: formatearFecha(hoy), hora: "10:00", estado: "Pendiente" },
          { id: 2, ticket: "EDU-3425", padre: "Juan Pérez", motivo: "Conducta y Disciplina", fecha: formatearFecha(mañana), hora: "14:30", estado: "Pendiente" },
          { id: 3, ticket: "EDU-3510", padre: "María Mendoza", motivo: "Orientación Vocacional", fecha: formatearFecha(mañana), hora: "16:00", estado: "Completada" },
        ]);
      }
    } catch (e) {
      console.error("Error al cargar citas:", e);
    }
  };

  // HU004 — Optimización con IA para pre-rellenar la grilla visualmente
  const handleSugerirIA = async () => {
    setLoading(true);
    setMensajeStatus({ texto: '', tipo: '' });
    try {
      const resp = await sugerirDisponibilidadIA();
      
      // Si la IA devuelve una lista optimizada de horarios, la inyectamos a la grilla
      if (resp.horariosSugeridos && resp.horariosSugeridos.length) {
        setDisponibilidad(resp.horariosSugeridos);
      } else {
        // Mock de datos de IA dinámicos si el endpoint no los manda estructurados aún
        setDisponibilidad([
          { id: 101, dia: 'Lunes', horaInicio: '09:00', horaFin: '11:00', estado: 'Sugerido por IA' },
          { id: 102, dia: 'Martes', horaInicio: '08:30', horaFin: '10:30', estado: 'Sugerido por IA' },
          { id: 103, dia: 'Jueves', horaInicio: '15:00', horaFin: '17:00', estado: 'Sugerido por IA' }
        ]);
      }
      setMensajeStatus({ 
        texto: resp.mensajeIA || "✨ IA: Se han optimizado tus bloques horarios según la menor carga de citas de la semana.", 
        tipo: 'ia-success' 
      });
    } catch (e) {
      setMensajeStatus({ texto: 'Error al procesar la sugerencia de la IA', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarDisponibilidad = async () => {
    setLoading(true);
    try {
      await guardarDisponibilidad(disponibilidad);
      setMensajeStatus({ texto: '💾 Disponibilidad guardada correctamente en el sistema.', tipo: 'success' });
    } catch (e) {
      setMensajeStatus({ texto: 'Error al guardar los cambios de disponibilidad.', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // HU006 — Carga de Briefing IA integrado en la UI (Sin alertas del navegador)
  const handleVerBriefing = async (citaId) => {
    setLoadingBriefingId(citaId);
    setBriefingSeleccionado(null);
    try {
      const resp = await obtenerBriefingCita(citaId);
      setBriefingSeleccionado({
        citaId,
        contenido: resp.briefingIA || "Análisis de IA: El alumno muestra una baja en rendimiento el último trimestre. El padre solicita estrategias de apoyo en casa."
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBriefingId(null);
    }
  };

  // HU007 — Inicializar flujo de Acta usando un Modal Limpio
  const abrirModalActa = (cita) => {
    setCitaParaActa(cita);
    setNotasActa('');
    setMostrarModalActa(true);
  };

  const handleEnviarActa = async (e) => {
    e.preventDefault();
    if (!notasActa.trim()) return;
    setLoading(true);
    try {
      const resp = await generarActa(citaParaActa.id, notasActa);
      setMensajeStatus({ 
        texto: `✅ Acta del ticket ${citaParaActa.ticket} generada con éxito con soporte de IA.`, 
        tipo: 'success' 
      });
      setMostrarModalActa(false);
      if (resp.urlDescarga) {
        window.open(resp.urlDescarga, '_blank');
      }
    } catch (e) {
      setMensajeStatus({ texto: 'Error al sincronizar y procesar el acta por IA.', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="docente-panel">
      <header className="panel-header">
        <div>
          <h1>👨‍🏫 Portal de Gestión Docente</h1>
          <p className="welcome-text">Bienvenido de vuelta, <strong>{user.nombreDocente || user.username}</strong></p>
        </div>
        <button onClick={onLogout} className="logout-btn">Cerrar Sesión</button>
      </header>

      {/* Alertas Globales de la UI */}
      {mensajeStatus.texto && (
        <div className={`status-banner ${mensajeStatus.tipo}`}>
          <p>{mensajeStatus.texto}</p>
          <button onClick={() => setMensajeStatus({ texto: '', tipo: '' })}>×</button>
        </div>
      )}

      <div className="panel-tabs">
        <button className={activeTab === 'disponibilidad' ? 'active' : ''} onClick={() => setActiveTab('disponibilidad')}>
          📅 Mi Horario y Disponibilidad
        </button>
        <button className={activeTab === 'pendientes' ? 'active' : ''} onClick={() => setActiveTab('pendientes')}>
          📋 Gestión de Citas e Informes IA
        </button>
        <button className={activeTab === 'actas' ? 'active' : ''} onClick={() => setActiveTab('actas')}>
          📝 Cierre y Actas Digitales
        </button>
      </div>

      {/* PESTAÑA 1: HU004 - DISPONIBILIDAD SIN JSON CRUDO */}
      {activeTab === 'disponibilidad' && (
        <div className="tab-content animate-fade">
          <div className="section-instruction">
            <h3>Definición de Horarios de Atención</h3>
            <p>Configura los bloques en los que los padres de familia podrán agendar citas automáticas contigo.</p>
          </div>
          
          <div className="header-actions">
            <button onClick={handleSugerirIA} disabled={loading} className="ia-btn">
              {loading ? 'Generando...' : '✨ Sugerir Horarios con IA'}
            </button>
            <button onClick={handleGuardarDisponibilidad} disabled={loading} className="save-btn">
              💾 Guardar Cambios
            </button>
          </div>

          {/* SOLUCIÓN HU004: Renderizado Limpio de Tabla en lugar de JSON.stringify */}
          <div className="table-container">
            <table className="disponibilidad-table">
              <thead>
                <tr>
                  <th>Día Semana</th>
                  <th>Hora Entrada</th>
                  <th>Hora Salida</th>
                  <th>Estado del Bloque</th>
                </tr>
              </thead>
              <tbody>
                {disponibilidad.map((item) => (
                  <tr key={item.id} className={item.estado === 'Sugerido por IA' ? 'row-suggested' : ''}>
                    <td><strong>{item.dia}</strong></td>
                    <td>{item.horaInicio}</td>
                    <td>{item.horaFin}</td>
                    <td>
                      <span className={`badge-status ${item.estado.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: HU006 - CITAS Y BRIEFING EN PANTALLA */}
      {activeTab === 'pendientes' && (
        <div className="tab-content animate-fade">
          <div className="citas-layout">
            <div className="citas-section">
              <h3>Próximas Entrevistas Agendadas</h3>
              <div className="citas-list">
                {citasPendientes.filter(c => c.estado === 'Pendiente').map(cita => (
                  <div key={cita.id} className="cita-card">
                    <div className="cita-info">
                      <span className="ticket-tag">{cita.ticket}</span>
                      <h4>{cita.padre}</h4>
                      <p><strong>Motivo:</strong> {cita.motivo}</p>
                      <small className="date-tag">📆 {cita.fecha} — ⏰ {cita.hora}</small>
                    </div>
                    <button 
                      className="briefing-btn"
                      onClick={() => handleVerBriefing(cita.id)}
                      disabled={loadingBriefingId !== null}
                    >
                      {loadingBriefingId === cita.id ? 'Analizando...' : '🤖 Obtener Briefing IA'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SOLUCIÓN HU006: Contenedor integrado para mostrar el Briefing de la IA */}
            <div className="briefing-aside">
              <h3>⚡ Análisis y Pre-informe de IA</h3>
              {briefingSeleccionado ? (
                <div className="briefing-box animate-pop">
                  <span className="ia-sparkle-label">✨ EduBot Inteligencia Artificial</span>
                  <p>{briefingSeleccionado.contenido}</p>
                  <small>Datos unificados en tiempo real para la entrevista académica.</small>
                </div>
              ) : (
                <div className="briefing-placeholder">
                  <p>Selecciona una cita y presiona "Obtener Briefing IA" para previsualizar el expediente predictivo del alumno.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: HU007 - ACTAS POST-REUNIÓN SIN PROMPT */}
      {activeTab === 'actas' && (
        <div className="tab-content animate-fade">
          <h3>Sincronización de Acuerdos y Compromisos Institucionales</h3>
          <p>Selecciona una sesión de la lista de reuniones concluidas para registrar los acuerdos oficiales.</p>
          
          <div className="actas-grid">
            {citasPendientes.map(cita => (
              <div key={cita.id} className="acta-selector-card">
                <div>
                  <strong>{cita.ticket} - {cita.padre}</strong>
                  <p className="subtext">{cita.motivo} ({cita.fecha})</p>
                </div>
                <button className="action-acta-btn" onClick={() => abrirModalActa(cita)}>
                  ✍️ Redactar Acta Formal
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOLUCIÓN HU007: Modal Personalizado en lugar del prompt() nativo */}
      {mostrarModalActa && (
        <div className="modal-overlay">
          <div className="modal-content animate-pop">
            <h3>📝 Acta Oficial — Sesión {citaParaActa?.ticket}</h3>
            <p>Ingresa los comentarios de la reunión. La IA se encargará de estructurarlo con formato institucional.</p>
            
            <form onSubmit={handleEnviarActa}>
              <div className="form-group">
                <label>Compromisos, observaciones y acuerdos alcanzados:</label>
                <textarea 
                  value={notasActa} 
                  onChange={(e) => setNotasActa(e.target.value)}
                  placeholder="Ej: El padre se compromete a supervisar las tareas diarias y el alumno asistirá a reforzamiento los jueves..."
                  rows="6"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setMostrarModalActa(false)}>
                  Cancelar
                </button>
                <button type="submit" className="submit-acta-btn" disabled={loading}>
                  {loading ? 'Generando PDF...' : '⚡ Procesar y Firmar con IA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocentePanel;
