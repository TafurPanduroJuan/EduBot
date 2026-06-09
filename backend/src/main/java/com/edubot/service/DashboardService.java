package com.edubot.service;

import com.edubot.dto.DashboardResumenDTO;
import com.edubot.integration.AIService;
import com.edubot.model.Cita;
import com.edubot.repository.CitaRepository;
import com.edubot.repository.DocenteRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * DashboardService — calcula las métricas del panel administrativo (HU008)
 * y delega en AIService la generación de alertas/insights.
 */
@Service
public class DashboardService {

    private final CitaRepository citaRepository;
    private final DocenteRepository docenteRepository;
    private final AIService aiService;

    public DashboardService(CitaRepository citaRepository,
                            DocenteRepository docenteRepository,
                            AIService aiService) {
        this.citaRepository = citaRepository;
        this.docenteRepository = docenteRepository;
        this.aiService = aiService;
    }

    /**
     * Genera el resumen completo del dashboard para el período indicado.
     *
     * @param periodo "semanal" | "mensual" | "anual"
     * @return DashboardResumenDTO con métricas + alertas IA
     */
    public DashboardResumenDTO generarResumen(String periodo) {
        LocalDate hoy = LocalDate.now();
        LocalDate inicio = calcularInicio(hoy, periodo);

        List<Cita> todasLasCitas = citaRepository.findAll().stream()
                .filter(c -> !c.getFecha().isBefore(inicio) && !c.getFecha().isAfter(hoy))
                .collect(Collectors.toList());

        List<Cita> completadas = todasLasCitas.stream()
                .filter(c -> "completada".equals(c.getEstado()))
                .collect(Collectors.toList());

        long conAsistencia = completadas.stream()
                .filter(c -> Boolean.TRUE.equals(c.getAsistio()))
                .count();

        double tasaAsistencia = completadas.isEmpty() ? 0.0
                : Math.round((conAsistencia * 100.0 / completadas.size()) * 10.0) / 10.0;

        // ── Top docentes ──────────────────────────────────────────────────
        List<Map<String, Object>> topDocentes = todasLasCitas.stream()
                .filter(c -> c.getDocente() != null)
                .collect(Collectors.groupingBy(
                        c -> c.getDocente().getId(),
                        Collectors.counting()
                ))
                .entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    docenteRepository.findById(e.getKey()).ifPresent(d ->
                            entry.put("nombre", d.getNombre() + " " + d.getApellido()));
                    entry.put("total", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());

        // ── Motivos frecuentes ────────────────────────────────────────────
        List<Map<String, Object>> motivosFrecuentes = todasLasCitas.stream()
                .filter(c -> c.getMotivo() != null)
                .collect(Collectors.groupingBy(Cita::getMotivo, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("motivo", e.getKey());
                    entry.put("total", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());

        // ── Citas por docente ─────────────────────────────────────────────
        List<Map<String, Object>> citasPorDocente = todasLasCitas.stream()
                .filter(c -> c.getDocente() != null)
                .collect(Collectors.groupingBy(
                        c -> c.getDocente().getId(),
                        Collectors.counting()
                ))
                .entrySet().stream()
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("docenteId", e.getKey());
                    docenteRepository.findById(e.getKey()).ifPresent(d ->
                            entry.put("nombre", d.getNombre() + " " + d.getApellido()));
                    entry.put("total", e.getValue());
                    return entry;
                })
                .sorted(Comparator.comparingLong(m -> -((Long) m.get("total"))))
                .collect(Collectors.toList());

        // ── IA: generar alertas/insights ──────────────────────────────────
        List<String> alertasIA = generarAlertasIA(todasLasCitas, tasaAsistencia, periodo);

        // ── Ensamblar respuesta ───────────────────────────────────────────
        DashboardResumenDTO dto = new DashboardResumenDTO();
        dto.setPeriodo(periodo);
        dto.setTotalCitas(todasLasCitas.size());
        dto.setCitasCompletadas(completadas.size());
        dto.setTasaAsistencia(tasaAsistencia);
        dto.setTopDocentes(topDocentes);
        dto.setMotivosFrecuentes(motivosFrecuentes);
        dto.setCitasPorDocente(citasPorDocente);
        dto.setAlertasIA(alertasIA);

        return dto;
    }

    private LocalDate calcularInicio(LocalDate hoy, String periodo) {
        return switch (periodo.toLowerCase()) {
            case "semanal" -> hoy.minusDays(7);
            case "anual"   -> hoy.minusYears(1);
            default        -> hoy.minusMonths(1);
        };
    }

    private List<String> generarAlertasIA(List<Cita> citas, double tasaAsistencia, String periodo) {
        try {
            return aiService.generarAlertasDashboard(citas, tasaAsistencia, periodo);
        } catch (Exception e) {
            return List.of("No se pudieron generar alertas automáticas en este momento.");
        }
    }
}