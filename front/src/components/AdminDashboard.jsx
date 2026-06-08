import { useState, useRef } from "react";
import "../assets/styles/AdminDashboard.css";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function AdminDashboard() {

  const dashboardRef = useRef();

  const [periodo, setPeriodo] = useState("mensual");

  const metricas = {
    totalCitas: 142,
    asistencia: "91%",
    motivoFrecuente: "Rendimiento Académico",
    docenteTop: "Juan Pérez"
  };

  const citasPorDocente = [
    { docente: "Juan Pérez", citas: 45 },
    { docente: "Ana Torres", citas: 32 },
    { docente: "Carlos Díaz", citas: 28 },
    { docente: "Rosa Gómez", citas: 18 }
  ];

  const disponibilidad = [
    {
      docente: "Juan Pérez",
      horario: "Lun-Vie 08:00 - 12:00"
    },
    {
      docente: "Ana Torres",
      horario: "Lun-Vie 14:00 - 17:00"
    },
    {
      docente: "Carlos Díaz",
      horario: "Mar-Jue 08:00 - 13:00"
    }
  ];

  const exportarCSV = () => {

    const filas = [
      ["Docente", "Citas"],
      ...citasPorDocente.map(d => [
        d.docente,
        d.citas
      ])
    ];

    const csv = filas.map(f => f.join(",")).join("\n");

    const blob = new Blob([csv], {
      type: "text/csv"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "dashboard.csv";
    a.click();
  };

  const exportarExcel = () => {

    const ws = XLSX.utils.json_to_sheet(citasPorDocente);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Dashboard"
    );

    XLSX.writeFile(
      wb,
      "dashboard.xlsx"
    );
  };

  const exportarPDF = async () => {

    const canvas = await html2canvas(
      dashboardRef.current
    );

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF(
      "p",
      "mm",
      "a4"
    );

    pdf.addImage(
      imgData,
      "PNG",
      10,
      10,
      190,
      0
    );

    pdf.save("dashboard.pdf");
  };

  const generarResumenIA = () => {

    const resumen = `
Resumen Ejecutivo IA

Durante el periodo ${periodo},
se registraron ${metricas.totalCitas} citas.

La tasa de asistencia alcanzó
${metricas.asistencia}.

El motivo predominante fue
${metricas.motivoFrecuente}.

Se observa una mayor demanda
en el docente ${metricas.docenteTop},
por lo que se recomienda
evaluar ampliación de horarios.
`;

    alert(resumen);
  };

  return (
    <div
      className="dashboard-container"
      ref={dashboardRef}
    >
      <div className="dashboard-header">

        <h1>
          Dashboard Administrativo
        </h1>

        <select
          value={periodo}
          onChange={(e)=>
            setPeriodo(e.target.value)
          }
        >
          <option value="semanal">
            Semanal
          </option>

          <option value="mensual">
            Mensual
          </option>

          <option value="anual">
            Anual
          </option>

        </select>

      </div>

      <div className="cards">

        <div className="card">
          <h3>Total Citas</h3>
          <span>{metricas.totalCitas}</span>
        </div>

        <div className="card">
          <h3>Asistencia</h3>
          <span>{metricas.asistencia}</span>
        </div>

        <div className="card">
          <h3>Motivo Frecuente</h3>
          <span>{metricas.motivoFrecuente}</span>
        </div>

        <div className="card">
          <h3>Docente Top</h3>
          <span>{metricas.docenteTop}</span>
        </div>

      </div>

      <div className="grafico">

        <h2>
          Citas por Docente
        </h2>

        <ResponsiveContainer
          width="100%"
          height={300}
        >

          <BarChart
            data={citasPorDocente}
          >

            <XAxis dataKey="docente" />

            <YAxis />

            <Tooltip />

            <Bar
              dataKey="citas"
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

      <div className="tabla">

        <h2>
          Disponibilidad Docentes
        </h2>

        <table>

          <thead>
            <tr>
              <th>Docente</th>
              <th>Horario</th>
            </tr>
          </thead>

          <tbody>

            {disponibilidad.map(
              (d, index) => (

              <tr key={index}>
                <td>{d.docente}</td>
                <td>{d.horario}</td>
              </tr>

            ))}

          </tbody>

        </table>

      </div>

      <div className="acciones">

        <button onClick={exportarCSV}>
          Exportar CSV
        </button>

        <button onClick={exportarExcel}>
          Exportar Excel
        </button>

        <button onClick={exportarPDF}>
          Exportar PDF
        </button>

        <button
          onClick={generarResumenIA}
        >
          Resumen Ejecutivo IA
        </button>

      </div>

    </div>
  );
}