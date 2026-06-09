import React, { useState } from 'react';
import EduBotChat from './components/EduBotChat.jsx';
import DocentePanel from './components/DocentePanel.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import { loginPanel } from './services/api';
import './App.css';

// ── Enrutador manual (sin react-router-dom) ───────────────────────────────────
// /        → chat público para padres (sin login)
// /panel   → login + panel para docentes/admins
// cualquier otra ruta → redirige a /
const path = window.location.pathname.replace(/\/$/, '') || '/';
const isPanelRoute = path === '/panel' || path.startsWith('/panel/');

// ── Vista pública: chat para padres ──────────────────────────────────────────
function ChatPublico() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span>E</span>
          </div>
          <div className="sidebar-info">
            <h1>EduBot</h1>
            <p>IE San Martín de Porres</p>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <EduBotChat />
      </main>
    </div>
  );
}

// ── Vista privada: panel docente / admin ─────────────────────────────────────
function PanelApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [error, setError]           = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    const credentials = {
      username: form.username.value,
      password: form.password.value,
    };
    try {
      const resp = await loginPanel(credentials);
      setUser(resp);
      setIsLoggedIn(true);
      setError('');
    } catch {
      setError('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
  };

  // ── Login ──
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <h1>EduBot Panel</h1>

          <form onSubmit={handleLogin}>
            <input name="username" placeholder="Usuario" required />
            <input name="password" type="password" placeholder="Contraseña" required />
            <button type="submit">Ingresar al Panel</button>
          </form>

          {error && <p className="error">{error}</p>}

          <p style={{ marginTop: '20px', fontSize: '14px' }}>
            Prueba: <strong>docente_1</strong> / <strong>docente1123</strong>
          </p>

          {/* Enlace de vuelta al chat público */}
          <p style={{ marginTop: '12px', fontSize: '13px' }}>
            ¿Eres padre?{' '}
            <a href="/" style={{ color: '#7B1F3A', fontWeight: 600 }}>
              Ir al chat de citas
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Panel según rol ──
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><span>E</span></div>
          <div className="sidebar-info">
            <h1>EduBot</h1>
            <p>IE San Martín de Porres</p>
          </div>
        </div>
      </aside>
      <main className="app-main">
        {user?.rol === 'ADMINISTRATIVO' ? (
          <AdminDashboard user={user} onLogout={handleLogout} />
        ) : user?.rol === 'DOCENTE' ? (
          <DocentePanel user={user} onLogout={handleLogout} />
        ) : (
          // Rol desconocido — no debería pasar, redirige al chat
          <EduBotChat />
        )}
      </main>
    </div>
  );
}

// ── Raíz ──────────────────────────────────────────────────────────────────────
export default function App() {
  if (isPanelRoute) return <PanelApp />;
  return <ChatPublico />;
}
