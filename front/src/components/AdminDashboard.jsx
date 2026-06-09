import { useState, useRef, useEffect } from "react";
import "../assets/styles/AdminDashboard.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
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
      { tipo: "error", texto: "Prof. Rosa Gómez: 0 citas esta semana — disponibilidad sin configurar." },
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

const PIE_COLORS = ["#7B1F3A", "#c0536d", "#e8a0b0", "#f5d4db"];

// ── Componente contador animado ──────────────────────────────────────────────
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

export default function AdminDashboard() {
  const dashboardRef = useRef();
  const [periodo, setPeriodo] = useState("mensual");
  const [alertasDismissed, setAlertasDismissed] = useState([]);
  const [resumenIA, setResumenIA] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [exportando, setExportando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");

  const d = DATA[periodo];

  const dismissAlerta = (i) => setAlertasDismissed(prev => [...prev, i]);

  const alertasVisibles = d.alertas.filter((_, i) => !alertasDismissed.includes(`${periodo}-${i}`));

  const generarResumenIA = () => {
    setLoadingIA(true);
    setResumenIA(null);
    setTimeout(() => {
      setResumenIA(
        `En el período ${periodo} se realizaron ${d.totalCitas} citas con ${d.asistencia}% de asistencia. ` +
        `El motivo principal fue ${d.motivos[0].name} (${d.motivos[0].value}%). ` +
        `Se recomienda reforzar acompañamiento en 3er grado A y ampliar la disponibilidad del Prof. Juan Pérez ` +
        `los martes de tarde, que concentran mayor demanda.`
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
      const filas = [["Docente", "Citas"], ...d.citas.map(r => [r.docente, r.citas])];
      const csv = filas.map(f => f.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `edubot_${periodo}.csv`;
      a.click();
      setExportando(null);
    }, 600);
  };

  const citasFiltradas = filtroEstado === "Todos"
    ? d.citasRecientes
    : d.citasRecientes.filter(c => c.estado === filtroEstado);

  // Resetear alertas dismissidas al cambiar período
  useEffect(() => { setAlertasDismissed([]); setResumenIA(null); }, [periodo]);

  return (
    <div className="adm-wrap" ref={dashboardRef}>

      {/* ── Header ── */}
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Dashboard Administrativo</h1>
          <p className="adm-subtitle">IE San Martín de Porres · Actualizado ahora</p>
        </div>
        <div className="adm-header-right">
          <div className="adm-periodo-tabs">
            {["semanal","mensual","anual"].map(p => (
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
      </div>

      {/* ── KPI Cards ── */}
      <div className="adm-kpi-grid">
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon kpi-purple">📅</div>
          <div>
            <p className="adm-kpi-label">Citas este período</p>
            <p className="adm-kpi-value"><AnimatedNumber target={d.totalCitas} /></p>
          </div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon kpi-green">✅</div>
          <div>
            <p className="adm-kpi-label">Tasa asistencia</p>
            <p className="adm-kpi-value"><AnimatedNumber target={d.asistencia} suffix="%" /></p>
          </div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon kpi-gold">⭐</div>
          <div>
            <p className="adm-kpi-label">Satisfacción</p>
            <p className="adm-kpi-value">{d.satisfaccion} <span className="adm-kpi-sub">/ 5.0</span></p>
          </div>
        </div>
        <div className="adm-kpi-card kpi-highlight">
          <div className="adm-kpi-icon kpi-red">👨‍🏫</div>
          <div>
            <p className="adm-kpi-label">Motivo frecuente</p>
            <p className="adm-kpi-value adm-kpi-text">{d.motivos[0].name}</p>
          </div>
        </div>
      </div>

      {/* ── Alertas IA ── */}
      {alertasVisibles.length > 0 && (
        <div className="adm-alertas-section">
          <div className="adm-alertas-header">
            <span className="adm-ia-badge">✦ Alertas IA</span>
            <span className="adm-alertas-fecha">
              {periodo === "mensual" ? "Mar 2026" : periodo === "semanal" ? "Esta semana" : "2026"}
            </span>
          </div>
          {alertasVisibles.map((a, i) => (
            <div key={i} className={`adm-alerta adm-alerta-${a.tipo}`}>
              <span>{a.tipo === "warning" ? "⚠️" : a.tipo === "error" ? "🔴" : "ℹ️"} {a.texto}</span>
              <button className="adm-alerta-close" onClick={() => setAlertasDismissed(prev => [...prev, `${periodo}-${i}`])}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Gráficos ── */}
      <div className="adm-charts-grid">
        <div className="adm-chart-card">
          <h2 className="adm-section-title">Citas por Docente</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.citas} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="docente" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
                cursor={{ fill: "#f5e8ec" }}
              />
              <Bar dataKey="citas" fill="#7B1F3A" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="adm-chart-card">
          <h2 className="adm-section-title">Motivos de Cita</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={d.motivos}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
                labelLine={false}
              >
                {d.motivos.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Citas Recientes ── */}
      <div className="adm-table-card">
        <div className="adm-table-header">
          <h2 className="adm-section-title">Citas Recientes</h2>
          <div className="adm-filtro-tabs">
            {["Todos", "Pendiente", "Confirmada", "Completada"].map(f => (
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
                  <td><span className={`adm-estado adm-estado-${c.estado.toLowerCase()}`}>{c.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resumen IA ── */}
      <div className="adm-ia-section">
        <div className="adm-ia-header">
          <span className="adm-ia-badge">✦ Resumen Ejecutivo IA</span>
          <button className="adm-ia-btn" onClick={generarResumenIA} disabled={loadingIA}>
            {loadingIA ? "Analizando..." : "✦ Generar Resumen"}
          </button>
        </div>
        {loadingIA && (
          <div className="adm-ia-loading">
            <div className="adm-spinner" />
            <span>EduBot IA está analizando los datos del período...</span>
          </div>
        )}
        {resumenIA && !loadingIA && (
          <div className="adm-ia-resultado">
            <p>{resumenIA}</p>
          </div>
        )}
        {!resumenIA && !loadingIA && (
          <p className="adm-ia-placeholder">
            Presiona "Generar Resumen" para obtener un análisis automático del período seleccionado.
          </p>
        )}
      </div>

      {/* ── Exportar UGEL ── */}
      <div className="adm-export-card">
        <div className="adm-export-header">
          <div>
            <h2 className="adm-section-title">Exportar Reporte UGEL</h2>
            <p className="adm-export-desc">Genera el informe oficial para presentar a la UGEL</p>
          </div>
        </div>
        <div className="adm-export-btns">
          <button
            className={`adm-export-btn adm-export-excel ${exportando === "excel" ? "loading" : ""}`}
            onClick={exportarExcel}
            disabled={!!exportando}
          >
            {exportando === "excel" ? "Generando..." : "📊 Excel"}
          </button>
          <button
            className={`adm-export-btn adm-export-csv ${exportando === "csv" ? "loading" : ""}`}
            onClick={exportarCSV}
            disabled={!!exportando}
          >
            {exportando === "csv" ? "Generando..." : "📄 CSV"}
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
  );
}
