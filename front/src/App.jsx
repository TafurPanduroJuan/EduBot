import React, { useState } from 'react';
import EduBotChat from './components/EduBotChat.jsx';
import DocentePanel from './components/DocentePanel.jsx';
import { loginPanel } from './services/api';
import './App.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isDocente, setIsDocente] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    const credentials = {
      username: form.username.value,
      password: form.password.value
    };

    try {
      const resp = await loginPanel(credentials);
      setUser(resp);
      setIsLoggedIn(true);
      setIsDocente(resp.rol === 'DOCENTE');
      setError('');
    } catch (err) {
      setError('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <h1>EduBot Panel</h1>
          <form onSubmit={handleLogin}>
            <input name="username" placeholder="Usuario (ej: docente_1)" required />
            <input name="password" type="password" placeholder="Contraseña" required />
            <button type="submit">Ingresar al Panel</button>
          </form>
          {error && <p className="error">{error}</p>}
          <p style={{marginTop: '20px', fontSize: '14px'}}>
            Prueba: <strong>docente_1</strong> / <strong>docente1123</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        {/* Sidebar igual que antes */}
        <div className="sidebar-header">
          <div className="sidebar-logo"><span>E</span></div>
          <div className="sidebar-info">
            <h1>EduBot</h1>
            <p>IE San Martín de Porres</p>
          </div>
        </div>
      </aside>

      <main className="app-main">
        {isDocente ? (
          <DocentePanel user={user} onLogout={handleLogout} />
        ) : (
          <EduBotChat />
        )}
      </main>
    </div>
  );
}