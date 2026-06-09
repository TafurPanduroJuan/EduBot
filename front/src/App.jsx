import React, { useState } from 'react';
import EduBotChat from './components/EduBotChat.jsx';
import DocentePanel from './components/DocentePanel.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import { loginPanel } from './services/api';
import './App.css';

// ── Enrutador manual (sin react-router-dom) ───────────────────────────────────
const path = window.location.pathname.replace(/\/$/, '') || '/';
const isPanelRoute = path === '/panel' || path.startsWith('/panel/');

// ── Vista pública: chat para padres ──────────────────────────────────────────
function ChatPublico() {
  const [showLoginHint, setShowLoginHint] = useState(false);

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

      {/* ── Botón flotante de acceso al panel (Ubicado a la izquierda y reordenado) ── */}
      <div className="panel-access-btn-wrapper">
        {showLoginHint && (
          <div className="panel-access-tooltip">
            Acceso exclusivo para personal de la institución
          </div>
        )}
        <button
          className="panel-access-btn"
          onClick={() => window.location.href = '/panel'}
          onMouseEnter={() => setShowLoginHint(true)}
          onMouseLeave={() => setShowLoginHint(false)}
          title="Acceso para docentes y administradores"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Panel Docente</span>
        </button>
      </div>
    </div>
  );
}

// ── Vista privada: panel docente / admin ─────────────────────────────────────
function PanelApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = e.target;
    const credentials = {
      username: form.username.value,
      password: form.password.value,
    };
    try {
      const resp = await loginPanel(credentials);
      setUser(resp);
      setIsLoggedIn(true);
    } catch {
      setError('Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.');
    } finally {
      setLoading(false);
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
        {/* Panel izquierdo: branding */}
        <div className="login-brand">
          <div className="login-brand-inner">
            <div className="login-brand-logo">
              <span>E</span>
            </div>
            <h1 className="login-brand-title">EduBot</h1>
            <p className="login-brand-subtitle">IE San Martín de Porres</p>
            <div className="login-brand-divider" />
            <p className="login-brand-desc">
              Portal de gestión exclusivo para docentes y personal administrativo de la institución educativa.
            </p>
            <div className="login-brand-features">
              <div className="login-feature">
                <span className="login-feature-icon">📅</span>
                <span>Gestión de citas con padres</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon">📊</span>
                <span>Panel administrativo</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon">🤖</span>
                <span>Asistente IA integrado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho: formulario */}
        <div className="login-form-panel">
          <div className="login-form-inner">
            {/* Back link */}
            <a href="/" className="login-back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Volver al chat de citas
            </a>

            <div className="login-form-header">
              <h2>Acceso al Panel</h2>
              <p>Ingresa con tus credenciales institucionales</p>
            </div>

            <div className="login-role-badges">
              <span className="role-badge role-docente">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
                Docente
              </span>
              <span className="role-badge role-admin">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Administrador
              </span>
            </div>

            <form onSubmit={handleLogin} className="login-form" noValidate>
              <div className="login-field">
                <label htmlFor="username">Usuario</label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Tu usuario institucional"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Contraseña</label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-toggle-pass"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Ingresar al Panel
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="login-demo-hint">
              Demo: <strong>docente_1</strong> / <strong>docente1123</strong>
            </p>
          </div>
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
          <EduBotChat />
        )}
      </main>
    </div>
  );
}

export default function App() {
  if (isPanelRoute) return <PanelApp />;
  return <ChatPublico />;
}