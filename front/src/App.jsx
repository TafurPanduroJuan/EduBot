import React, { useState } from 'react'
import EduBotChat from './components/EduBotChat.jsx'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">E</span>
          </div>
          <div className="sidebar-info">
            <h1 className="sidebar-title">EduBot</h1>
            <p className="sidebar-sub">IE San Martín de Porres</p>
          </div>
        </div>
        <div className="sidebar-desc">
          <p>Asistente virtual para gestión de citas con docentes.</p>
          <div className="sidebar-hours">
            <span>🕐</span> Lun–Vie · 8:00 AM – 4:00 PM
          </div>
        </div>
        <div className="sidebar-features">
          <div className="feature-item">
            <span className="feature-icon">📅</span>
            <span>Agenda citas rápidamente</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🤖</span>
            <span>Horarios sugeridos con IA</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📄</span>
            <span>Actas con firma digital OTP</span>
          </div>
        </div>
      </aside>

      {/* Chat panel */}
      <main className="app-main">
        <EduBotChat />
      </main>
    </div>
  )
}
