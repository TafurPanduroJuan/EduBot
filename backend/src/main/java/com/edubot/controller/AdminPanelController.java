package com.edubot.controller;

import com.edubot.dto.DashboardResumenDTO;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.repository.DisponibilidadRepository;
import com.edubot.service.DashboardService;
import com.edubot.service.ExportacionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * AdminPanelController — endpoints exclusivos del panel ADMINISTRATIVO.
 *
 * Todas las rutas bajo /api/panel/admin/** ya están protegidas en SecurityConfig
 * con hasRole('ADMINISTRATIVO') — no se toca nada de seguridad existente.
 *
 * HU008 — Dashboard con métricas y alertas IA.
 * HU009 — Exportación de reportes (PDF/Excel/CSV) + gestión de disponibilidades.
 */
@RestController
@RequestMapping("/api/panel/admin")
@PreAuthorize("hasRole('ADMINISTRATIVO')")
@Tag(name = "Panel Administrativo", description = "Dashboard y exportación de reportes (HU008, HU009)")
public class AdminPanelController {

    private final DashboardService dashboardService;
    private final ExportacionService exportacionService;
    private final DisponibilidadRepository disponibilidadRepository;

    public AdminPanelController(DashboardService dashboardService,
                                 ExportacionService exportacionService,
                                 DisponibilidadRepository disponibilidadRepository) {
        this.dashboardService = dashboardService;
        this.exportacionService = exportacionService;
        this.disponibilidadRepository = disponibilidadRepository;
    }

    // ── HU008: Dashboard resumen ──────────────────────────────────────────────

    @Operation(summary = "Obtener métricas del dashboard",
               description = "Devuelve métricas del período y alertas generadas por IA")
    @GetMapping("/dashboard/resumen")
    public ResponseEntity<DashboardResumenDTO> obtenerResumen(
            @RequestParam(defaultValue = "mensual") String periodo) {

        DashboardResumenDTO resumen = dashboardService.generarResumen(periodo);
        return ResponseEntity.ok(resumen);
    }

    // ── HU009: Exportación de reportes ───────────────────────────────────────

    @Operation(summary = "Exportar reporte",
               description = "Genera y descarga el reporte en formato pdf, excel o csv")
    @GetMapping("/reportes/exportar")
    public ResponseEntity<byte[]> exportarReporte(
            @RequestParam(defaultValue = "pdf") String formato,
            @RequestParam(defaultValue = "mensual") String periodo) {

        try {
            ExportacionService.ResultadoExportacion resultado =
                    exportacionService.exportar(formato, periodo);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(resultado.getContentType()));
            headers.setContentDispositionFormData("attachment", resultado.getNombreArchivo());

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resultado.getBytes());

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ── HU009: Disponibilidades de todos los docentes (solo lectura) ──────────

    @Operation(summary = "Ver disponibilidades de todos los docentes",
               description = "Solo lectura para el administrador")
    @GetMapping("/disponibilidades")
    public ResponseEntity<List<DisponibilidadDocente>> obtenerTodasDisponibilidades() {
        List<DisponibilidadDocente> todas = disponibilidadRepository.findAll();
        return ResponseEntity.ok(todas);
    }

    // ── HU009: Disponibilidades de un docente específico ─────────────────────

    @Operation(summary = "Ver disponibilidades de un docente específico")
    @GetMapping("/disponibilidades/{docenteId}")
    public ResponseEntity<?> obtenerDisponibilidadesPorDocente(
            @PathVariable Long docenteId) {

        LocalDate hoy = LocalDate.now();
        List<DisponibilidadDocente> bloques =
                disponibilidadRepository
                        .findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(docenteId, hoy);

        return ResponseEntity.ok(Map.of(
                "docenteId", docenteId,
                "bloques", bloques
        ));
    }
}