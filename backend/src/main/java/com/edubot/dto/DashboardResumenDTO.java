package com.edubot.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * DashboardResumenDTO — respuesta del endpoint GET /api/panel/admin/dashboard/resumen
 * Agrupa todas las métricas calculadas para el período solicitado (HU008).
 */
@Data
public class DashboardResumenDTO {

    /** Período consultado: "semanal", "mensual" o "anual" */
    private String periodo;

    /** Total de citas en el período */
    private long totalCitas;

    /** Citas completadas en el período */
    private long citasCompletadas;

    /** Tasa de asistencia: (asistio=true / completadas) * 100, redondeado */
    private double tasaAsistencia;

    /**
     * Docentes con más citas en el período, ordenados descendente.
     * Cada entrada: { "nombre": "Juan Pérez", "total": 12 }
     */
    private List<Map<String, Object>> topDocentes;

    /**
     * Distribución de motivos en el período.
     * Cada entrada: { "motivo": "rendimiento", "total": 20 }
     */
    private List<Map<String, Object>> motivosFrecuentes;

    /**
     * Total de citas agrupadas por docente.
     * Cada entrada: { "docenteId": 1, "nombre": "...", "total": 8 }
     */
    private List<Map<String, Object>> citasPorDocente;

    /**
     * 2-3 alertas o insights generados por IA a partir de las métricas.
     */
    private List<String> alertasIA;
}