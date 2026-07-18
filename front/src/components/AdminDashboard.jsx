import { useState, useEffect, useCallback } from "react";
import "../assets/styles/AdminDashboard.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  obtenerResumenDashboard,
  obtenerTodasDisponibilidades,
  exportarReporteBackend,
  listarDocentesAdmin,
  crearDocenteAdmin,
  crearCredencialesDocente,
  resetearPasswordDocente,
  listarPadresAdmin,
  crearPadreAdmin,
  crearEstudianteAdmin,
} from "../services/api";

// ── Colores y helpers ────────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "" }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil((target || 0) / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= (target || 0)) {
        setValue(target || 0);
        clearInterval(timer);
      } else {
        setValue(start);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{value}{suffix}</span>;
}

function MotivosBars({ motivos }) {
  if (!motivos || motivos.length === 0) return null;
  const total = motivos.reduce((s, m) => s + (m.total || 0), 0);
  return (
    <div className="adm-motivos-list">
      <p className="adm-motivos-title">Motivos frecuentes</p>
      {motivos.map((m) => {
        const pct = total > 0 ? Math.round((m.total / total) * 100) : 0;
        return (
          <div key={m.motivo} className="adm-motivo-row">
            <span className="adm-motivo-name">{m.motivo}</span>
            <div className="adm-motivo-bar-wrap">
              <div className="adm-motivo-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="adm-motivo-pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers de validación de formularios ─────────────────────────────────────
// Solo letras (con tildes/ñ) y espacios — usado en Nombre / Apellido para que
// no se puedan escribir números ni caracteres especiales.
const soloLetras = (valor) => valor.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, "");
// Solo dígitos, con un largo máximo — usado en DNI / Teléfono.
const soloDigitos = (valor, maxLen) => valor.replace(/\D/g, "").slice(0, maxLen);

// El valor guardado en BD es el value crudo del <select> ("manana", "tarde",
// "noche"); esto solo lo traduce a la etiqueta legible para mostrarlo en la
// tabla (antes se imprimía tal cual, sin la tilde: "manana").
const HORARIO_LABELS = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };
const horarioLabel = (valor) => (valor ? (HORARIO_LABELS[valor] || valor) : "—");

// ── Modal genérico ───────────────────────────────────────────────────────────
function ModalCard({ title, subtitle, onClose, children }) {
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-header">
          <div>
            <h3 className="adm-modal-title">{title}</h3>
            {subtitle && <p className="adm-modal-subtitle">{subtitle}</p>}
          </div>
          <button className="adm-modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Formulario: Nuevo Docente ────────────────────────────────────────────────
function NuevoDocenteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nombre: "", apellido: "", curso: "", email: "",
    crearCredenciales: false, username: "", password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    if (form.crearCredenciales && (!form.username.trim() || !form.password.trim())) {
      setError("Si vas a crear credenciales, completa usuario y contraseña.");
      return;
    }
    setSaving(true);
    try {
      await crearDocenteAdmin({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        curso: form.curso.trim() || null,
        email: form.email.trim() || null,
        crearCredenciales: form.crearCredenciales,
        username: form.username.trim() || undefined,
        password: form.password || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.message || "No se pudo registrar al docente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalCard
      title="Nuevo docente"
      subtitle="Registra a un profesor y, si quieres, su acceso al panel"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="adm-form-error">⚠ {error}</div>}

        <div className="adm-form-grid">
          <div className="adm-form-field">
            <label className="adm-form-label">Nombre <span className="req">*</span></label>
            <input className="adm-form-input" value={form.nombre} onChange={set("nombre")} placeholder="Ricardo" />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Apellido <span className="req">*</span></label>
            <input className="adm-form-input" value={form.apellido} onChange={set("apellido")} placeholder="Flores" />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Curso / materia</label>
            <input className="adm-form-input" value={form.curso} onChange={set("curso")} placeholder="Comunicación" />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Email</label>
            <input className="adm-form-input" type="email" value={form.email} onChange={set("email")} placeholder="ricardo.flores@colegio.edu.pe" />
          </div>
        </div>

        <label className="adm-form-checkbox-row">
          <input type="checkbox" checked={form.crearCredenciales} onChange={set("crearCredenciales")} />
          Crear credenciales de acceso al panel para este docente
        </label>

        {form.crearCredenciales && (
          <div className="adm-form-grid">
            <div className="adm-form-field">
              <label className="adm-form-label">Usuario <span className="req">*</span></label>
              <input className="adm-form-input" value={form.username} onChange={set("username")} placeholder="ricardo.flores" />
            </div>
            <div className="adm-form-field">
              <label className="adm-form-label">Contraseña <span className="req">*</span></label>
              <input className="adm-form-input" type="text" value={form.password} onChange={set("password")} placeholder="colegio2026" />
            </div>
          </div>
        )}

        <div className="adm-form-actions">
          <button type="button" className="adm-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="adm-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Registrar docente"}
          </button>
        </div>
      </form>
    </ModalCard>
  );
}

// ── Formulario: Nuevo Padre de familia ───────────────────────────────────────
function NuevoPadreModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    dni: "", nombre: "", apellido: "", telefono: "", horarioLaboral: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => {
    let valor = e.target.value;
    if (field === "nombre" || field === "apellido") valor = soloLetras(valor);
    else if (field === "dni") valor = soloDigitos(valor, 8);
    else if (field === "telefono") valor = soloDigitos(valor, 9);
    setForm((f) => ({ ...f, [field]: valor }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{8}$/.test(form.dni)) {
      setError("El DNI debe tener exactamente 8 dígitos numéricos.");
      return;
    }
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(form.nombre.trim()) ||
        !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(form.apellido.trim())) {
      setError("Nombre y apellido solo pueden contener letras.");
      return;
    }
    if (form.telefono.trim() && !/^\d{9}$/.test(form.telefono.trim())) {
      setError("El teléfono debe tener exactamente 9 dígitos numéricos.");
      return;
    }
    setSaving(true);
    try {
      await crearPadreAdmin({
        dni: form.dni.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim() || null,
        horarioLaboral: form.horarioLaboral || null,
      });
      onCreated();
    } catch (err) {
      setError(err.message || "No se pudo registrar al padre de familia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalCard
      title="Nuevo padre de familia"
      subtitle="Necesario para que el padre pueda identificarse por DNI en EduBot"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="adm-form-error">⚠ {error}</div>}

        <div className="adm-form-field">
          <label className="adm-form-label">DNI <span className="req">*</span></label>
          <input
            className="adm-form-input"
            value={form.dni}
            onChange={set("dni")}
            placeholder="71234567"
            maxLength={8}
            inputMode="numeric"
          />
        </div>

        <div className="adm-form-grid">
          <div className="adm-form-field">
            <label className="adm-form-label">Nombre <span className="req">*</span></label>
            <input className="adm-form-input" value={form.nombre} onChange={set("nombre")} placeholder="Rosa" maxLength={60} />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Apellido <span className="req">*</span></label>
            <input className="adm-form-input" value={form.apellido} onChange={set("apellido")} placeholder="Mamani" maxLength={60} />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Teléfono</label>
            <input
              className="adm-form-input"
              value={form.telefono}
              onChange={set("telefono")}
              placeholder="987654321"
              maxLength={9}
              inputMode="numeric"
            />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Horario laboral</label>
            <select className="adm-form-select" value={form.horarioLaboral} onChange={set("horarioLaboral")}>
              <option value="">Sin especificar</option>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
            </select>
          </div>
        </div>

        <div className="adm-form-actions">
          <button type="button" className="adm-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="adm-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Registrar padre"}
          </button>
        </div>
      </form>
    </ModalCard>
  );
}

// ── Formulario: Nuevo Hijo (vinculado a un padre) ───────────────────────────
function NuevoHijoModal({ padre, onClose, onCreated }) {
  const [form, setForm] = useState({ nombre: "", apellido: "", grado: "", seccion: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => {
    let valor = e.target.value;
    if (field === "nombre" || field === "apellido") valor = soloLetras(valor);
    setForm((f) => ({ ...f, [field]: valor }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(form.nombre.trim()) ||
        !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(form.apellido.trim())) {
      setError("Nombre y apellido solo pueden contener letras.");
      return;
    }
    setSaving(true);
    try {
      await crearEstudianteAdmin(padre.id, {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        grado: form.grado.trim() || null,
        seccion: form.seccion.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(err.message || "No se pudo vincular al estudiante.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalCard
      title="Agregar hijo"
      subtitle={`Vincular a ${padre.nombre} ${padre.apellido} (DNI ${padre.dni})`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="adm-form-error">⚠ {error}</div>}
        <div className="adm-form-grid">
          <div className="adm-form-field">
            <label className="adm-form-label">Nombre <span className="req">*</span></label>
            <input className="adm-form-input" value={form.nombre} onChange={set("nombre")} placeholder="Luis" />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Apellido <span className="req">*</span></label>
            <input className="adm-form-input" value={form.apellido} onChange={set("apellido")} placeholder="Mamani" />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Grado</label>
            <input className="adm-form-input" value={form.grado} onChange={set("grado")} placeholder="3ro" />
          </div>
          <div className="adm-form-field">
            <label className="adm-form-label">Sección</label>
            <input className="adm-form-input" value={form.seccion} onChange={set("seccion")} placeholder="A" />
          </div>
        </div>
        <div className="adm-form-actions">
          <button type="button" className="adm-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="adm-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Vincular hijo"}
          </button>
        </div>
      </form>
    </ModalCard>
  );
}

// ── Formulario: Crear credenciales / Restablecer contraseña de docente ──────
function CredencialesModal({ docente, mode, onClose, onDone }) {
  const sugerido =
    mode === "crear"
      ? `${docente.nombre}.${docente.apellido}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "")
      : docente.username || "";

  const [username, setUsername] = useState(sugerido);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === "crear" && !username.trim()) {
      setError("El usuario es obligatorio.");
      return;
    }
    if (!password || password.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "crear") {
        const resp = await crearCredencialesDocente(docente.id, { username: username.trim(), password });
        setResultado({ username: resp.username || username.trim(), password });
      } else {
        await resetearPasswordDocente(docente.id, password);
        setResultado({ username: docente.username, password });
      }
    } catch (err) {
      setError(err.message || "No se pudo completar la operación.");
    } finally {
      setSaving(false);
    }
  };

  const copiar = () => {
    const texto = `Usuario: ${resultado.username}\nContraseña: ${resultado.password}`;
    navigator.clipboard?.writeText(texto);
    setCopiado(true);
  };

  if (resultado) {
    return (
      <ModalCard
        title={mode === "crear" ? "Credenciales creadas" : "Contraseña restablecida"}
        subtitle={`${docente.nombre} ${docente.apellido}`}
        onClose={onDone}
      >
        <div className="adm-form-success">
          ✓ Entrega estos datos al docente por un medio seguro (WhatsApp, en persona, etc.)
        </div>
        <div className="adm-cred-result">
          <div className="adm-cred-result-row">
            <span className="adm-cred-result-label">Usuario</span>
            <span className="adm-cred-result-value">{resultado.username}</span>
          </div>
          <div className="adm-cred-result-row">
            <span className="adm-cred-result-label">Contraseña</span>
            <span className="adm-cred-result-value">{resultado.password}</span>
          </div>
        </div>
        <div className="adm-form-actions">
          <button type="button" className="adm-btn-secondary" onClick={copiar}>
            {copiado ? "✓ Copiado" : "Copiar datos"}
          </button>
          <button type="button" className="adm-btn-primary" onClick={onDone}>Listo</button>
        </div>
      </ModalCard>
    );
  }

  return (
    <ModalCard
      title={mode === "crear" ? "Crear credenciales" : "Restablecer contraseña"}
      subtitle={`${docente.nombre} ${docente.apellido}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="adm-form-error">⚠ {error}</div>}
        {mode === "crear" && (
          <div className="adm-form-field">
            <label className="adm-form-label">Usuario <span className="req">*</span></label>
            <input
              className="adm-form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ricardo.flores"
            />
          </div>
        )}
        <div className="adm-form-field">
          <label className="adm-form-label">
            {mode === "crear" ? "Contraseña" : "Nueva contraseña"} <span className="req">*</span>
          </label>
          <input
            className="adm-form-input"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="colegio2026"
            autoFocus
          />
        </div>
        <div className="adm-form-actions">
          <button type="button" className="adm-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="adm-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : mode === "crear" ? "Crear credenciales" : "Restablecer"}
          </button>
        </div>
      </form>
    </ModalCard>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminDashboard({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [periodo, setPeriodo] = useState("mensual");

  // Estado del dashboard
  const [resumen, setResumen] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [errorDash, setErrorDash] = useState(null);

  // Estado de docentes (disponibilidad, usado en el gráfico del dashboard)
  const [docentes, setDocentes] = useState([]);
  const [loadingDocentes, setLoadingDocentes] = useState(false);

  // Estado de docentes registrados (para el formulario/listado de alta)
  const [docentesLista, setDocentesLista] = useState([]);
  const [loadingDocentesLista, setLoadingDocentesLista] = useState(false);
  const [errorDocentesLista, setErrorDocentesLista] = useState(null);
  const [showNuevoDocente, setShowNuevoDocente] = useState(false);
  const [credencialesModal, setCredencialesModal] = useState(null); // { docente, mode: "crear" | "reset" }

  // Estado de padres de familia
  const [padres, setPadres] = useState([]);
  const [loadingPadres, setLoadingPadres] = useState(false);
  const [errorPadres, setErrorPadres] = useState(null);
  const [showNuevoPadre, setShowNuevoPadre] = useState(false);
  const [hijoModalPadre, setHijoModalPadre] = useState(null);

  // UI
  const [alertasDismissed, setAlertasDismissed] = useState([]);
  const [exportando, setExportando] = useState(null);
  const [exportPeriodo, setExportPeriodo] = useState("mensual");

  // ── Carga del dashboard ──────────────────────────────────────────────────
  const cargarResumen = useCallback(async () => {
    setLoadingDash(true);
    setErrorDash(null);
    setAlertasDismissed([]);
    try {
      const data = await obtenerResumenDashboard(periodo);
      setResumen(data);
    } catch (e) {
      setErrorDash(e.message || "Error al cargar el dashboard");
    } finally {
      setLoadingDash(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  // ── Carga de docentes ────────────────────────────────────────────────────
  const cargarDocentes = useCallback(async () => {
    if (activeNav !== "docentes") return;
    setLoadingDocentes(true);
    try {
      const data = await obtenerTodasDisponibilidades();
      // data es lista de DisponibilidadDocente; agrupar por docente
      const map = {};
      (data || []).forEach((d) => {
        const id = d.docente?.id;
        if (!id) return;
        if (!map[id]) {
          map[id] = {
            nombre: `${d.docente.nombre} ${d.docente.apellido}`,
            curso: d.docente.curso || "—",
            grado: d.docente.grado || "—",
            bloques: 0,
          };
        }
        map[id].bloques++;
      });
      setDocentes(Object.values(map));
    } catch {
      setDocentes([]);
    } finally {
      setLoadingDocentes(false);
    }
  }, [activeNav]);

  useEffect(() => {
    cargarDocentes();
  }, [cargarDocentes]);

  // ── Carga de docentes registrados (alta / listado admin) ────────────────
  const cargarDocentesLista = useCallback(async () => {
    if (activeNav !== "docentes") return;
    setLoadingDocentesLista(true);
    setErrorDocentesLista(null);
    try {
      const data = await listarDocentesAdmin();
      setDocentesLista(data || []);
    } catch (e) {
      setErrorDocentesLista(e.message || "Error al cargar los docentes");
    } finally {
      setLoadingDocentesLista(false);
    }
  }, [activeNav]);

  useEffect(() => {
    cargarDocentesLista();
  }, [cargarDocentesLista]);

  // ── Carga de padres de familia ───────────────────────────────────────────
  const cargarPadres = useCallback(async () => {
    if (activeNav !== "padres") return;
    setLoadingPadres(true);
    setErrorPadres(null);
    try {
      const data = await listarPadresAdmin();
      setPadres(data || []);
    } catch (e) {
      setErrorPadres(e.message || "Error al cargar los padres de familia");
    } finally {
      setLoadingPadres(false);
    }
  }, [activeNav]);

  useEffect(() => {
    cargarPadres();
  }, [cargarPadres]);

  // ── Exportar desde backend ───────────────────────────────────────────────
  const exportar = async (formato) => {
    setExportando(formato);
    try {
      await exportarReporteBackend(formato, exportPeriodo);
    } catch {
      alert("Error al generar el reporte. Intenta de nuevo.");
    } finally {
      setExportando(null);
    }
  };

  // ── Derivados del resumen ────────────────────────────────────────────────
  const alertasIA = resumen?.alertasIA || [];
  const alertasVisibles = alertasIA.filter(
    (_, i) => !alertasDismissed.includes(`${periodo}-${i}`)
  );

  // citasPorDocente → formato para el BarChart
  const citasBarData = (resumen?.citasPorDocente || []).map((d) => ({
    docente: d.nombre || `Docente ${d.docenteId}`,
    citas: d.total,
  }));

  // Para la tabla de citas recientes buscamos topDocentes como proxy
  // El backend no tiene endpoint de citas recientes con detalles en el DTO,
  // así que mostramos citasPorDocente como resumen.

  const periodoLabel = {
    semanal: "Esta semana",
    mensual: new Date().toLocaleString("es-PE", { month: "long", year: "numeric" }),
    anual: new Date().getFullYear().toString(),
  }[periodo] || periodo;

  const navItems = [
    { key: "dashboard", icon: "⊞", label: "Dashboard" },
    { key: "docentes",  icon: "👤", label: "Docentes"  },
    { key: "padres",    icon: "👪", label: "Padres"    },
    { key: "reportes",  icon: "⬇",  label: "Reportes"  },
  ];

  return (
    <div className="adm-shell">
      {/* ── Sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-top">
          <div className="adm-sidebar-avatar">A</div>
          <div className="adm-sidebar-brand">
            <span className="adm-sidebar-role">Panel Admin</span>
            <span className="adm-sidebar-school">IE San Martín</span>
          </div>
        </div>
        <nav className="adm-sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`adm-nav-item ${activeNav === item.key ? "active" : ""}`}
              onClick={() => setActiveNav(item.key)}
            >
              <span className="adm-nav-icon">{item.icon}</span>
              <span className="adm-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="adm-sidebar-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </aside>

      {/* ── Main Content ── */}
      <div className="adm-main">

        {/* ════════ DASHBOARD ════════ */}
        {activeNav === "dashboard" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Dashboard Administrativo</h1>
                <p className="adm-subtitle">
                  Resumen — {periodoLabel}
                  <span className="adm-subtitle-update">
                    {" "}· Actualizado: {new Date().toLocaleDateString("es-PE")}
                  </span>
                </p>
              </div>
              <div className="adm-periodo-tabs">
                {["semanal", "mensual", "anual"].map((p) => (
                  <button
                    key={p}
                    className={`adm-periodo-tab ${periodo === p ? "active" : ""}`}
                    onClick={() => setPeriodo(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading / Error */}
            {loadingDash && (
              <div className="adm-loading">
                <div className="adm-spinner" />
                <span>Cargando datos del servidor…</span>
              </div>
            )}
            {errorDash && !loadingDash && (
              <div className="adm-alerta adm-alerta-error" style={{ marginBottom: 16 }}>
                <span>⚠ {errorDash}</span>
                <button className="adm-alerta-close" onClick={cargarResumen}>↻ Reintentar</button>
              </div>
            )}

            {!loadingDash && resumen && (
              <>
                {/* KPI Cards */}
                <div className="adm-kpi-grid">
                  <div className="adm-kpi-card">
                    <p className="adm-kpi-value">
                      <AnimatedNumber target={resumen.totalCitas} />
                    </p>
                    <p className="adm-kpi-label">Total citas</p>
                  </div>
                  <div className="adm-kpi-card">
                    <p className="adm-kpi-value">
                      <AnimatedNumber target={Math.round(resumen.tasaAsistencia)} suffix="%" />
                    </p>
                    <p className="adm-kpi-label">Tasa asistencia</p>
                  </div>
                  <div className="adm-kpi-card">
                    <p className="adm-kpi-value">
                      <AnimatedNumber target={resumen.citasCompletadas} />
                    </p>
                    <p className="adm-kpi-label">Completadas</p>
                  </div>
                  <div className="adm-kpi-card">
                    <p className="adm-kpi-value">
                      <AnimatedNumber target={resumen.citasPendientes} />
                    </p>
                    <p className="adm-kpi-label">Pendientes</p>
                  </div>
                  <div className="adm-kpi-card">
                    <p className="adm-kpi-value">
                        <AnimatedNumber target={resumen.actasGeneradas} />
                    </p>
                    <p className="adm-kpi-label">Actas generadas</p>
                  </div>
                </div>

                {/* Alertas IA */}
                {alertasVisibles.length > 0 && (
                  <div className="adm-alertas-section">
                    <div className="adm-alertas-header">
                      <span className="adm-ia-badge">✦ Alertas IA — {periodoLabel}</span>
                    </div>
                    {alertasVisibles.map((texto, i) => (
                      <div key={i} className="adm-alerta adm-alerta-warning">
                        <span>· {texto}</span>
                        <button
                          className="adm-alerta-close"
                          onClick={() =>
                            setAlertasDismissed((prev) => [...prev, `${periodo}-${i}`])
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Charts */}
                <div className="adm-charts-grid">
                  <div className="adm-chart-card">
                    <h2 className="adm-section-title">Citas por Docente</h2>
                    {citasBarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={citasBarData}
                          margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                        >
                          <XAxis dataKey="docente" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                            cursor={{ fill: "#f5e8ec" }}
                          />
                          <Bar dataKey="citas" fill="#7B1F3A" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="adm-empty">Sin datos para el período</p>
                    )}
                  </div>

                  <div className="adm-chart-card">
                    <MotivosBars motivos={resumen.motivosFrecuentes} />
                  </div>
                </div>

                {/* Top Docentes */}
                <div className="adm-table-card">
                  <div className="adm-table-header">
                    <h2 className="adm-section-title">Top Docentes — {periodoLabel}</h2>
                  </div>
                  <div className="adm-table-scroll">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Docente</th>
                          <th>Total citas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.topDocentes?.length === 0 && (
                          <tr>
                            <td colSpan={3} className="adm-empty">Sin datos para este período</td>
                          </tr>
                        )}
                        {(resumen.topDocentes || []).map((d, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td><strong>{d.nombre || `Docente ${d.docenteId}`}</strong></td>
                            <td>{d.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════ DOCENTES ════════ */}
        {activeNav === "docentes" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Docentes</h1>
                <p className="adm-subtitle">Registro de profesores y su disponibilidad</p>
              </div>
              <div className="adm-header-actions">
                <button className="adm-btn-new" onClick={() => setShowNuevoDocente(true)}>
                  + Nuevo docente
                </button>
              </div>
            </div>

            {/* Tabla de docentes registrados (alta / credenciales) */}
            <div className="adm-table-card" style={{ marginBottom: 20 }}>
              <div className="adm-table-header">
                <h2 className="adm-section-title">Docentes registrados</h2>
              </div>
              {errorDocentesLista && !loadingDocentesLista && (
                <div className="adm-alerta adm-alerta-error" style={{ margin: "0 20px 12px" }}>
                  <span>⚠ {errorDocentesLista}</span>
                  <button className="adm-alerta-close" onClick={cargarDocentesLista}>↻ Reintentar</button>
                </div>
              )}
              {loadingDocentesLista ? (
                <div className="adm-loading">
                  <div className="adm-spinner" />
                  <span>Cargando docentes…</span>
                </div>
              ) : (
                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Docente</th>
                        <th>Curso</th>
                        <th>Email</th>
                        <th>Estado</th>
                        <th>Credenciales</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {docentesLista.length === 0 && (
                        <tr>
                          <td colSpan={6} className="adm-empty">
                            Aún no hay docentes registrados
                          </td>
                        </tr>
                      )}
                      {docentesLista.map((d) => (
                        <tr key={d.id}>
                          <td><strong>{d.nombre} {d.apellido}</strong></td>
                          <td>{d.curso || "—"}</td>
                          <td>{d.email || "—"}</td>
                          <td>
                            <span className={`adm-estado ${d.activo ? "adm-estado-confirmada" : "adm-estado-pendiente"}`}>
                              {d.activo ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            {d.tieneCredenciales ? (
                              <span className="adm-credencial-si">✓ {d.username}</span>
                            ) : (
                              <span className="adm-credencial-no">Sin credenciales</span>
                            )}
                          </td>
                          <td>
                            {d.tieneCredenciales ? (
                              <button className="adm-btn-link-add" onClick={() => setCredencialesModal({ docente: d, mode: "reset" })}>
                                Restablecer contraseña
                              </button>
                            ) : (
                              <button className="adm-btn-link-add" onClick={() => setCredencialesModal({ docente: d, mode: "crear" })}>
                                + Crear credenciales
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="adm-table-card">
              <div className="adm-table-header">
                <h2 className="adm-section-title">Disponibilidad configurada</h2>
              </div>
              {loadingDocentes ? (
                <div className="adm-loading">
                  <div className="adm-spinner" />
                  <span>Cargando docentes…</span>
                </div>
              ) : (
                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Docente</th>
                        <th>Curso</th>
                        <th>Grado</th>
                        <th>Disponibilidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docentes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="adm-empty">
                            Sin docentes con disponibilidad configurada
                          </td>
                        </tr>
                      )}
                      {docentes.map((d, i) => (
                        <tr key={i}>
                          <td><strong>{d.nombre}</strong></td>
                          <td>{d.curso}</td>
                          <td>{d.grado}</td>
                          <td>
                            <span className={`adm-estado ${d.bloques > 0 ? "adm-estado-confirmada" : "adm-estado-pendiente"}`}>
                              {d.bloques > 0 ? `Configurada (${d.bloques} bloques)` : "Sin configurar"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ PADRES ════════ */}
        {activeNav === "padres" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Padres de familia</h1>
                <p className="adm-subtitle">Registro de padres y sus hijos matriculados</p>
              </div>
              <div className="adm-header-actions">
                <button className="adm-btn-new" onClick={() => setShowNuevoPadre(true)}>
                  + Nuevo padre
                </button>
              </div>
            </div>

            <div className="adm-table-card">
              <div className="adm-table-header">
                <h2 className="adm-section-title">Lista de padres</h2>
              </div>
              {errorPadres && !loadingPadres && (
                <div className="adm-alerta adm-alerta-error" style={{ margin: "0 20px 12px" }}>
                  <span>⚠ {errorPadres}</span>
                  <button className="adm-alerta-close" onClick={cargarPadres}>↻ Reintentar</button>
                </div>
              )}
              {loadingPadres ? (
                <div className="adm-loading">
                  <div className="adm-spinner" />
                  <span>Cargando padres de familia…</span>
                </div>
              ) : (
                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>DNI</th>
                        <th>Padre / Madre</th>
                        <th>Teléfono</th>
                        <th>Horario laboral</th>
                        <th>Hijos</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {padres.length === 0 && (
                        <tr>
                          <td colSpan={6} className="adm-empty">
                            Aún no hay padres de familia registrados
                          </td>
                        </tr>
                      )}
                      {padres.map((p) => (
                        <tr key={p.id}>
                          <td>{p.dni}</td>
                          <td><strong>{p.nombre} {p.apellido}</strong></td>
                          <td>{p.telefono || "—"}</td>
                          <td>{horarioLabel(p.horarioLaboral)}</td>
                          <td>
                            <div className="adm-hijos-cell">
                              {(p.estudiantes || []).length === 0 && (
                                <span className="adm-empty" style={{ padding: 0 }}>Sin hijos vinculados</span>
                              )}
                              {(p.estudiantes || []).map((h) => (
                                <span key={h.id} className="adm-hijo-chip">
                                  {h.nombre} {h.apellido}{h.grado ? ` · ${h.grado}${h.seccion ? h.seccion : ""}` : ""}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button className="adm-btn-link-add" onClick={() => setHijoModalPadre(p)}>
                              + Agregar hijo
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ REPORTES ════════ */}
        {activeNav === "reportes" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Exportar reporte UGEL</h1>
                <p className="adm-subtitle">
                  Genera el informe oficial para presentar a la UGEL
                </p>
              </div>
            </div>

            <div className="adm-export-filters-card">
              <div className="adm-export-filter-row">
                <div className="adm-export-filter-group">
                  <label className="adm-export-filter-label">Período</label>
                  <select
                    className="adm-export-filter-input"
                    value={exportPeriodo}
                    onChange={(e) => setExportPeriodo(e.target.value)}
                  >
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="adm-export-card">
              <h2 className="adm-section-title" style={{ marginBottom: 16 }}>
                Formato de exportación:
              </h2>
              <div className="adm-export-btns">
                <button
                  className={`adm-export-btn adm-export-excel ${exportando === "excel" ? "loading" : ""}`}
                  onClick={() => exportar("excel")}
                  disabled={!!exportando}
                >
                  <span className="adm-export-btn-icon">⊞</span>
                  {exportando === "excel" ? "Generando…" : "Excel"}
                </button>
                <button
                  className={`adm-export-btn adm-export-pdf ${exportando === "pdf" ? "loading" : ""}`}
                  onClick={() => exportar("pdf")}
                  disabled={!!exportando}
                >
                  <span className="adm-export-btn-icon">📄</span>
                  {exportando === "pdf" ? "Generando…" : "PDF"}
                </button>
                <button
                  className={`adm-export-btn adm-export-csv ${exportando === "csv" ? "loading" : ""}`}
                  onClick={() => exportar("csv")}
                  disabled={!!exportando}
                >
                  <span className="adm-export-btn-icon">🗄</span>
                  {exportando === "csv" ? "Generando…" : "CSV"}
                </button>
              </div>
              <button
                className="adm-export-main-btn"
                onClick={() => exportar("excel")}
                disabled={!!exportando}
              >
                ⬇ Generar y descargar reporte
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      {showNuevoDocente && (
        <NuevoDocenteModal
          onClose={() => setShowNuevoDocente(false)}
          onCreated={() => {
            setShowNuevoDocente(false);
            cargarDocentesLista();
          }}
        />
      )}
      {showNuevoPadre && (
        <NuevoPadreModal
          onClose={() => setShowNuevoPadre(false)}
          onCreated={() => {
            setShowNuevoPadre(false);
            cargarPadres();
          }}
        />
      )}
      {credencialesModal && (
        <CredencialesModal
          docente={credencialesModal.docente}
          mode={credencialesModal.mode}
          onClose={() => setCredencialesModal(null)}
          onDone={() => {
            setCredencialesModal(null);
            cargarDocentesLista();
          }}
        />
      )}
      {hijoModalPadre && (
        <NuevoHijoModal
          padre={hijoModalPadre}
          onClose={() => setHijoModalPadre(null)}
          onCreated={() => {
            setHijoModalPadre(null);
            cargarPadres();
          }}
        />
      )}
    </div>
  );
}