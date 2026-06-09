import { useState, useRef, useEffect } from "react";
import "../assets/styles/AdminDashboard.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";

// ── Datos simulados por período ──────────────────────────────────────────────
const DATA = {
  semanal: {
    totalCitas: 12,
    asistencia: 83,
    satisfaccion: 4.1,
    citas: [
      { docente: "Juan Pérez", citas: 5 },
      { docente: "Ana Torres", citas: 3 },
      { docente: "Carlos Díaz", citas: 2 },
      { docente: "Rosa Gómez", citas: 2 },
    ],
    motivos: [
      { name: "Rendimiento", value: 50 },
      { name: "Conducta", value: 25 },
      { name: "Salud", value: 15 },
      { name: "Otro", value: 10 },
    ],
    alertas: [
      { tipo: "warning", texto: "Martes 4pm tiene 2× más demanda — ¿habilitar más turnos?" },
      { tipo: "error", texto: "Prof. Rosa Gómez: 0 citas esta semana — disponibilidad sin configurar." },
    ],
    citasRecientes: [
      { ticket: "EDU-7980", padre: "Rosa Mamani", docente: "Juan Pérez", motivo: "Rendimiento", fecha: "Hoy 10:00", estado: "Confirmada" },
      { ticket: "EDU-7981", padre: "Luis García", docente: "Ana Torres", motivo: "Conducta", fecha: "Hoy 11:30", estado: "Pendiente" },
      { ticket: "EDU-7982", padre: "María Flores", docente: "Carlos Díaz", motivo: "Orientación", fecha: "Mañana 09:00", estado: "Pendiente" },
    ],
  },
  mensual: {
    totalCitas: 47,
    asistencia: 89,
    satisfaccion: 4.2,
    citas: [
      { docente: "Juan Pérez", citas: 18 },
      { docente: "Ana Torres", citas: 13 },
      { docente: "Carlos Díaz", citas: 9 },
      { docente: "Rosa Gómez", citas: 7 },
    ],
    motivos: [
      { name: "Rendimiento", value: 65 },
      { name: "Conducta", value: 20 },
      { name: "Salud", value: 10 },
      { name: "Otro", value: 5 },
    ],
    alertas: [
      { tipo: "warning", texto: "Martes 4pm tiene 3× más demanda — ¿habilitar más turnos?" },
      { tipo: "error", texto: "Prof. García: 0 citas esta semana — disponibilidad sin configurar." },
    ],
    citasRecientes: [
      { ticket: "EDU-7963", padre: "Rosa Mamani", docente: "Juan Pérez", motivo: "Rendimiento", fecha: "10 Mar 3:00 PM", estado: "Completada" },
      { ticket: "EDU-7971", padre: "Carmen Ruiz", docente: "Ana Torres", motivo: "Conducta", fecha: "11 Mar 4:00 PM", estado: "Completada" },
      { ticket: "EDU-7979", padre: "Pedro Silva", docente: "Carlos Díaz", motivo: "Salud", fecha: "12 Mar 10:00 AM", estado: "Confirmada" },
      { ticket: "EDU-7980", padre: "Luisa Vargas", docente: "Juan Pérez", motivo: "Rendimiento", fecha: "13 Mar 3:30 PM", estado: "Pendiente" },
    ],
  },
  anual: {
    totalCitas: 312,
    asistencia: 87,
    satisfaccion: 4.0,
    citas: [
      { docente: "Juan Pérez", citas: 102 },
      { docente: "Ana Torres", citas: 88 },
      { docente: "Carlos Díaz", citas: 74 },
      { docente: "Rosa Gómez", citas: 48 },
    ],
    motivos: [
      { name: "Rendimiento", value: 60 },
      { name: "Conducta", value: 22 },
      { name: "Salud", value: 11 },
      { name: "Otro", value: 7 },
    ],
    alertas: [
      { tipo: "warning", texto: "3er grado A concentra el 35% de citas — reforzamiento recomendado." },
      { tipo: "info", texto: "Tasa de asistencia anual: 87%. Meta institucional: 90%." },
    ],
    citasRecientes: [
      { ticket: "EDU-7940", padre: "Ana Torres", docente: "Juan Pérez", motivo: "Rendimiento", fecha: "Feb 28", estado: "Completada" },
      { ticket: "EDU-7950", padre: "Carlos Ríos", docente: "Ana Torres", motivo: "Conducta", fecha: "Mar 2", estado: "Completada" },
      { ticket: "EDU-7960", padre: "Sofía Huanca", docente: "Carlos Díaz", motivo: "Orientación", fecha: "Mar 7", estado: "Completada" },
    ],
  },
};

const DOCENTES_DATA = [
  { nombre: "Juan Pérez", curso: "Comunicación", grado: "3er A", citas: 18, disponibilidad: "Configurada" },
  { nombre: "Ana Torres", curso: "Matemáticas", grado: "2do B", citas: 13, disponibilidad: "Configurada" },
  { nombre: "Carlos Díaz", curso: "Ciencias", grado: "4to A", citas: 9, disponibilidad: "Configurada" },
  { nombre: "Rosa Gómez", curso: "Historia", grado: "1er C", citas: 0, disponibilidad: "Sin configurar" },
];

const PIE_COLORS = ["#7B1F3A", "#c0536d", "#e8a0b0", "#f5d4db"];

function AnimatedNumber({ target, suffix = "" }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(start);
    }, 30);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{value}{suffix}</span>;
}

// Motivos horizontal bars como en el mockup HU008
function MotivosBars({ motivos }) {
  return (
    <div className="adm-motivos-list">
      <p className="adm-motivos-title">Motivos frecuentes</p>
      {motivos.map((m) => (
        <div key={m.name} className="adm-motivo-row">
          <span className="adm-motivo-name">{m.name}</span>
          <div className="adm-motivo-bar-wrap">
            <div
              className="adm-motivo-bar"
              style={{ width: `${m.value}%` }}
            />
          </div>
          <span className="adm-motivo-pct">{m.value}%</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [periodo, setPeriodo] = useState("mensual");
  const [alertasDismissed, setAlertasDismissed] = useState([]);
  const [resumenIA, setResumenIA] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [exportando, setExportando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [exportPeriodo, setExportPeriodo] = useState("Feb – Mar 2026");
  const [exportDocente, setExportDocente] = useState("Todos los docentes");

  const d = DATA[periodo];

  const alertasVisibles = d.alertas.filter(
    (_, i) => !alertasDismissed.includes(`${periodo}-${i}`)
  );

  const generarResumenIA = () => {
    setLoadingIA(true);
    setResumenIA(null);
    setTimeout(() => {
      setResumenIA(
        `En ${exportPeriodo} se realizaron ${d.totalCitas} citas con ${d.asistencia}% de asistencia. ` +
        `El motivo principal fue ${d.motivos[0].name} (${d.motivos[0].value}%). ` +
        `Se recomienda reforzar acompañamiento en 3er grado A.`
      );
      setLoadingIA(false);
    }, 1400);
  };

  const exportarExcel = () => {
    setExportando("excel");
    setTimeout(() => {
      const ws = XLSX.utils.json_to_sheet(d.citas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
      XLSX.writeFile(wb, `edubot_${periodo}.xlsx`);
      setExportando(null);
    }, 600);
  };

  const exportarCSV = () => {
    setExportando("csv");
    setTimeout(() => {
      const filas = [["Docente", "Citas"], ...d.citas.map((r) => [r.docente, r.citas])];
      const csv = filas.map((f) => f.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `edubot_${periodo}.csv`;
      a.click();
      setExportando(null);
    }, 600);
  };

  const citasFiltradas =
    filtroEstado === "Todos"
      ? d.citasRecientes
      : d.citasRecientes.filter((c) => c.estado === filtroEstado);

  useEffect(() => {
    setAlertasDismissed([]);
    setResumenIA(null);
  }, [periodo]);

  // ── NAV ITEMS ──
  const navItems = [
    { key: "dashboard", icon: "⊞", label: "Dashboard" },
    { key: "docentes",  icon: "👤", label: "Docentes"  },
    { key: "citas",     icon: "📅", label: "Citas"     },
    { key: "reportes",  icon: "⬇", label: "Reportes"  },
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

        {/* ════════════════ DASHBOARD ════════════════ */}
        {activeNav === "dashboard" && (
          <div className="adm-wrap">
            {/* Header */}
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Dashboard Administrativo</h1>
                <p className="adm-subtitle">
                  Resumen —{" "}
                  {periodo === "mensual"
                    ? "Marzo 2026"
                    : periodo === "semanal"
                    ? "Esta semana"
                    : "2026"}
                  <span className="adm-subtitle-update"> · Actualizado: 10 Mar 2026 · 3:17 pm</span>
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

            {/* KPI Cards — exactamente como mockup: 3 métricas principales */}
            <div className="adm-kpi-grid">
              <div className="adm-kpi-card">
                <p className="adm-kpi-value">
                  <AnimatedNumber target={d.totalCitas} />
                </p>
                <p className="adm-kpi-label">Citas este mes</p>
              </div>
              <div className="adm-kpi-card">
                <p className="adm-kpi-value">
                  <AnimatedNumber target={d.asistencia} suffix="%" />
                </p>
                <p className="adm-kpi-label">Tasa asistencia</p>
              </div>
              <div className="adm-kpi-card">
                <p className="adm-kpi-value">{d.satisfaccion}</p>
                <p className="adm-kpi-label">Satisfacción</p>
              </div>
            </div>

            {/* Alertas IA — como mockup */}
            {alertasVisibles.length > 0 && (
              <div className="adm-alertas-section">
                <div className="adm-alertas-header">
                  <span className="adm-ia-badge">✦ Alertas IA —{" "}
                    {periodo === "mensual" ? "Marzo 2026" : periodo === "semanal" ? "Esta semana" : "2026"}
                  </span>
                </div>
                {alertasVisibles.map((a, i) => (
                  <div key={i} className={`adm-alerta adm-alerta-${a.tipo}`}>
                    <span>
                      {a.tipo === "warning" ? "·" : "·"} {a.texto}
                    </span>
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

            {/* Motivos frecuentes (horizontal bars) + Gráfico de citas por docente */}
            <div className="adm-charts-grid">
              <div className="adm-chart-card">
                <h2 className="adm-section-title">Citas por Docente</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={d.citas} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="docente" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: "#f5e8ec" }}
                    />
                    <Bar dataKey="citas" fill="#7B1F3A" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="adm-chart-card">
                <MotivosBars motivos={d.motivos} />
              </div>
            </div>

            {/* Citas Recientes */}
            <div className="adm-table-card">
              <div className="adm-table-header">
                <h2 className="adm-section-title">Citas Recientes</h2>
                <div className="adm-filtro-tabs">
                  {["Todos", "Pendiente", "Confirmada", "Completada"].map((f) => (
                    <button
                      key={f}
                      className={`adm-filtro-tab ${filtroEstado === f ? "active" : ""}`}
                      onClick={() => setFiltroEstado(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Padre / Apoderado</th>
                      <th>Docente</th>
                      <th>Motivo</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="adm-empty">
                          Sin citas para este filtro
                        </td>
                      </tr>
                    ) : (
                      citasFiltradas.map((c, i) => (
                        <tr key={i}>
                          <td>
                            <span className="adm-ticket">{c.ticket}</span>
                          </td>
                          <td>{c.padre}</td>
                          <td>{c.docente}</td>
                          <td>{c.motivo}</td>
                          <td className="adm-fecha">{c.fecha}</td>
                          <td>
                            <span className={`adm-estado adm-estado-${c.estado.toLowerCase()}`}>
                              {c.estado}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ DOCENTES ════════════════ */}
        {activeNav === "docentes" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Docentes</h1>
                <p className="adm-subtitle">Gestión de docentes de IE San Martín</p>
              </div>
            </div>
            <div className="adm-table-card">
              <div className="adm-table-header">
                <h2 className="adm-section-title">Lista de Docentes</h2>
              </div>
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Docente</th>
                      <th>Curso</th>
                      <th>Grado</th>
                      <th>Citas (mes)</th>
                      <th>Disponibilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DOCENTES_DATA.map((d, i) => (
                      <tr key={i}>
                        <td><strong>{d.nombre}</strong></td>
                        <td>{d.curso}</td>
                        <td>{d.grado}</td>
                        <td>{d.citas}</td>
                        <td>
                          <span className={`adm-estado ${d.disponibilidad === "Configurada" ? "adm-estado-confirmada" : "adm-estado-pendiente"}`}>
                            {d.disponibilidad}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ CITAS ════════════════ */}
        {activeNav === "citas" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Citas</h1>
                <p className="adm-subtitle">Historial completo de citas</p>
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
            <div className="adm-table-card">
              <div className="adm-table-header">
                <h2 className="adm-section-title">Todas las Citas</h2>
                <div className="adm-filtro-tabs">
                  {["Todos", "Pendiente", "Confirmada", "Completada"].map((f) => (
                    <button
                      key={f}
                      className={`adm-filtro-tab ${filtroEstado === f ? "active" : ""}`}
                      onClick={() => setFiltroEstado(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Padre / Apoderado</th>
                      <th>Docente</th>
                      <th>Motivo</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citasFiltradas.length === 0 ? (
                      <tr><td colSpan={6} className="adm-empty">Sin citas para este filtro</td></tr>
                    ) : citasFiltradas.map((c, i) => (
                      <tr key={i}>
                        <td><span className="adm-ticket">{c.ticket}</span></td>
                        <td>{c.padre}</td>
                        <td>{c.docente}</td>
                        <td>{c.motivo}</td>
                        <td className="adm-fecha">{c.fecha}</td>
                        <td>
                          <span className={`adm-estado adm-estado-${c.estado.toLowerCase()}`}>
                            {c.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ REPORTES — HU009 mockup ════════════════ */}
        {activeNav === "reportes" && (
          <div className="adm-wrap">
            <div className="adm-header">
              <div>
                <h1 className="adm-title">Exportar reporte UGEL</h1>
                <p className="adm-subtitle">Genera el informe oficial para presentar a la UGEL</p>
              </div>
            </div>

            {/* Filtros período y docente */}
            <div className="adm-export-filters-card">
              <div className="adm-export-filter-row">
                <div className="adm-export-filter-group">
                  <label className="adm-export-filter-label">Período</label>
                  <input
                    className="adm-export-filter-input"
                    value={exportPeriodo}
                    onChange={(e) => setExportPeriodo(e.target.value)}
                  />
                </div>
                <div className="adm-export-filter-group">
                  <label className="adm-export-filter-label">Docente</label>
                  <select
                    className="adm-export-filter-input"
                    value={exportDocente}
                    onChange={(e) => setExportDocente(e.target.value)}
                  >
                    <option>Todos los docentes</option>
                    {DOCENTES_DATA.map((d) => (
                      <option key={d.nombre}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resumen IA — como en mockup HU009 */}
              <div className="adm-ia-section" style={{ marginBottom: 0 }}>
                <div className="adm-ia-header">
                  <span className="adm-ia-badge">✦ Resumen ejecutivo generado por IA</span>
                  <button
                    className="adm-ia-btn"
                    onClick={generarResumenIA}
                    disabled={loadingIA}
                  >
                    {loadingIA ? "Analizando..." : "✦ Generar"}
                  </button>
                </div>
                {loadingIA && (
                  <div className="adm-ia-loading">
                    <div className="adm-spinner" />
                    <span>EduBot IA está analizando los datos...</span>
                  </div>
                )}
                {resumenIA && !loadingIA && (
                  <div className="adm-ia-resultado">
                    <p>{resumenIA}</p>
                  </div>
                )}
                {!resumenIA && !loadingIA && (
                  <p className="adm-ia-placeholder">
                    Presiona "Generar" para obtener el resumen ejecutivo del período seleccionado.
                  </p>
                )}
              </div>
            </div>

            {/* Formato de exportación — 3 botones como en mockup */}
            <div className="adm-export-card">
              <h2 className="adm-section-title" style={{ marginBottom: 16 }}>
                Formato de exportación:
              </h2>
              <div className="adm-export-btns">
                <button
                  className={`adm-export-btn adm-export-excel ${exportando === "excel" ? "loading" : ""}`}
                  onClick={exportarExcel}
                  disabled={!!exportando}
                >
                  <span className="adm-export-btn-icon">⊞</span>
                  {exportando === "excel" ? "Generando..." : "Excel"}
                </button>
                <button
                  className={`adm-export-btn adm-export-pdf ${exportando === "pdf" ? "loading" : ""}`}
                  onClick={() => {
                    setExportando("pdf");
                    setTimeout(() => setExportando(null), 600);
                  }}
                  disabled={!!exportando}
                >
                  <span className="adm-export-btn-icon">📄</span>
                  {exportando === "pdf" ? "Generando..." : "PDF"}
                </button>
                <button
                  className={`adm-export-btn adm-export-csv ${exportando === "csv" ? "loading" : ""}`}
                  onClick={exportarCSV}
                  disabled={!!exportando}
                >
                  <span className="adm-export-btn-icon">🗄</span>
                  {exportando === "csv" ? "Generando..." : "CSV"}
                </button>
              </div>
              <button
                className="adm-export-main-btn"
                onClick={exportarExcel}
                disabled={!!exportando}
              >
                ⬇ Generar y descargar reporte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
