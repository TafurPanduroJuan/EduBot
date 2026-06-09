import { useState, useEffect, useCallback } from "react";
import "../assets/styles/AdminDashboard.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  obtenerResumenDashboard,
  obtenerTodasDisponibilidades,
  exportarReporteBackend,
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

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminDashboard({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [periodo, setPeriodo] = useState("mensual");

  // Estado del dashboard
  const [resumen, setResumen] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [errorDash, setErrorDash] = useState(null);

  // Estado de docentes
  const [docentes, setDocentes] = useState([]);
  const [loadingDocentes, setLoadingDocentes] = useState(false);

  // UI
  const [alertasDismissed, setAlertasDismissed] = useState([]);
  const [exportando, setExportando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [exportPeriodo, setExportPeriodo] = useState("mensual");
  const [exportDocente, setExportDocente] = useState("Todos los docentes");

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
                <p className="adm-subtitle">Disponibilidades registradas en el sistema</p>
              </div>
            </div>
            <div className="adm-table-card">
              <div className="adm-table-header">
                <h2 className="adm-section-title">Lista de Docentes</h2>
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
                <div className="adm-export-filter-group">
                  <label className="adm-export-filter-label">Docente</label>
                  <select
                    className="adm-export-filter-input"
                    value={exportDocente}
                    onChange={(e) => setExportDocente(e.target.value)}
                  >
                    <option>Todos los docentes</option>
                    {docentes.map((d) => (
                      <option key={d.nombre}>{d.nombre}</option>
                    ))}
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
    </div>
  );
}