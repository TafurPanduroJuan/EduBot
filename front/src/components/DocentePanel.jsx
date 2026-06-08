import React, { useState, useEffect } from 'react';
import { obtenerDisponibilidadDocente, guardarDisponibilidad, sugerirDisponibilidadIA, obtenerCitasPendientesDocente, obtenerBriefingCita, generarActa } from '../services/api';
import '../assets/styles/DocentePanel.css';

const DocentePanel = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('disponibilidad');
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [citasPendientes, setCitasPendientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensajeIA, setMensajeIA] = useState('');

  // Cargar datos iniciales
  useEffect(() => {
    cargarDisponibilidad();
    cargarCitasPendientes();
  }, []);

  const cargarDisponibilidad = async () => {
    try {
      const data = await obtenerDisponibilidadDocente();
      setDisponibilidad(data);
    } catch (e) {
      console.error(e);
    }
  };

  const cargarCitasPendientes = async () => {
    try {
      // Mock temporal (cámbialo cuando agregues el endpoint real)
      const mock = [
        { id: 1, ticket: "EDU-3421", padre: "Rosa López", motivo: "Rendimiento", fecha: "2025-06-10", hora: "10:00" },
        { id: 2, ticket: "EDU-3425", padre: "Juan Pérez", motivo: "Conducta", fecha: "2025-06-11", hora: "14:30" },
      ];
      setCitasPendientes(mock);
    } catch (e) {}
  };

  const handleSugerirIA = async () => {
    setLoading(true);
    try {
      const resp = await sugerirDisponibilidadIA();
      setMensajeIA(resp.mensajeIA || "Sugerencia generada por IA");
      // Aquí puedes pre-rellenar la grilla
      alert("¡Sugerencia IA aplicada! (Mock)");
    } catch (e) {
      alert("Error al obtener sugerencia IA");
    }
    setLoading(false);
  };

  const handleGenerarActa = async (citaId) => {
    const notas = prompt("Escribe tus acuerdos, compromisos y observaciones:");
    if (!notas) return;

    try {
      const resp = await generarActa(citaId, notas);
      alert(`✅ Acta generada!\n${resp.mensaje}\nURL: ${resp.urlDescarga}`);
      window.open(resp.urlDescarga, '_blank');
    } catch (e) {
      alert("Error generando acta");
    }
  };

  return (
    <div className="docente-panel">
      <header className="panel-header">
        <div>
          <h1>👨‍🏫 Panel Docente</h1>
          <p>Bienvenido, {user.nombreDocente || user.username}</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Cerrar Sesión</button>
      </header>

      <div className="panel-tabs">
        <button className={activeTab === 'disponibilidad' ? 'active' : ''} onClick={() => setActiveTab('disponibilidad')}>
          📅 Mi Disponibilidad (HU004)
        </button>
        <button className={activeTab === 'pendientes' ? 'active' : ''} onClick={() => setActiveTab('pendientes')}>
          📋 Citas Pendientes (HU006)
        </button>
        <button className={activeTab === 'actas' ? 'active' : ''} onClick={() => setActiveTab('actas')}>
          📝 Actas Post-Reunión (HU007)
        </button>
      </div>

      {activeTab === 'disponibilidad' && (
        <div className="tab-content">
          <div className="header-actions">
            <button onClick={handleSugerirIA} disabled={loading} className="ia-btn">
              ✨ Sugerir con IA
            </button>
            <button onClick={() => alert("Guardar cambios (implementar)")}>💾 Guardar Disponibilidad</button>
          </div>
          <p>{mensajeIA}</p>
          {/* Grilla de disponibilidad - se puede mejorar después */}
          <pre>{JSON.stringify(disponibilidad, null, 2)}</pre>
        </div>
      )}

      {activeTab === 'pendientes' && (
        <div className="tab-content">
          <h2>Citas Pendientes</h2>
          <div className="citas-list">
            {citasPendientes.map(cita => (
              <div key={cita.id} className="cita-card">
                <div>
                  <strong>{cita.padre}</strong> - {cita.motivo}<br />
                  <small>{cita.fecha} {cita.hora}</small>
                </div>
                <button onClick={async () => {
                  const briefing = await obtenerBriefingCita(cita.id);
                  alert(briefing.briefingIA || "Briefing IA generado");
                }}>
                  Ver Briefing IA
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'actas' && (
        <div className="tab-content">
          <h2>Actas Post-Reunión (HU007)</h2>
          <p>Selecciona una cita completada para generar acta:</p>
          {/* Lista de citas completadas + botón Generar Acta */}
          <button onClick={() => handleGenerarActa(1)}>Ejemplo: Generar Acta para EDU-3421</button>
        </div>
      )}
    </div>
  );
};

export default DocentePanel;