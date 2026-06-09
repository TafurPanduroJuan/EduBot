package com.edubot.controller;

import com.edubot.dto.DisponibilidadRequest;
import com.edubot.model.Cita;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.repository.CitaRepository;
import com.edubot.service.DisponibilidadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * DocentePanelController — endpoints del panel exclusivos para DOCENTES.
 */
@RestController
@RequestMapping("/api/panel/docente")
@PreAuthorize("hasRole('DOCENTE')")
public class DocentePanelController {

    private final DisponibilidadService disponibilidadService;
    private final CitaRepository citaRepository;

    public DocentePanelController(DisponibilidadService disponibilidadService,
                                   CitaRepository citaRepository) {
        this.disponibilidadService = disponibilidadService;
        this.citaRepository = citaRepository;
    }

    // ── HU004: Ver disponibilidad propia ────────────────────────────────────

    @GetMapping("/disponibilidad")
    public ResponseEntity<?> obtenerDisponibilidad(HttpServletRequest request) {
        Long docenteId = extraerDocenteId(request);
        if (docenteId == null) return errorSinVinculo();

        List<DisponibilidadDocente> bloques =
                disponibilidadService.obtenerDisponibilidad(docenteId);

        return ResponseEntity.ok(bloques);
    }

    // ── HU004: Guardar disponibilidad ────────────────────────────────────────

    @PostMapping("/disponibilidad")
    public ResponseEntity<?> guardarDisponibilidad(
            @Valid @RequestBody DisponibilidadRequest req,
            HttpServletRequest request) {

        Long docenteId = extraerDocenteId(request);
        if (docenteId == null) return errorSinVinculo();

        try {
            List<DisponibilidadDocente> creados =
                    disponibilidadService.guardarDisponibilidad(docenteId, req);

            return ResponseEntity.ok(Map.of(
                    "mensaje", creados.size() + " bloque(s) guardados correctamente.",
                    "bloques", creados
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── HU004: Sugerencia de bloques con IA ─────────────────────────────────

    @GetMapping("/disponibilidad/sugerir")
    public ResponseEntity<?> sugerirDisponibilidad(HttpServletRequest request) {
        Long docenteId = extraerDocenteId(request);
        if (docenteId == null) return errorSinVinculo();

        try {
            Map<String, Object> sugerencia =
                    disponibilidadService.sugerirBloques(docenteId);
            return ResponseEntity.ok(sugerencia);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── HU005: Citas pendientes / próximas del docente ───────────────────────

    /**
     * GET /api/panel/docente/citas-pendientes
     * Devuelve las citas del docente autenticado que están pendientes o confirmadas,
     * con fecha >= hoy, ordenadas por fecha+hora.
     */
    @GetMapping("/citas-pendientes")
    public ResponseEntity<?> obtenerCitasPendientes(HttpServletRequest request) {
        Long docenteId = extraerDocenteId(request);
        if (docenteId == null) return errorSinVinculo();

        LocalDate hoy = LocalDate.now();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM", new java.util.Locale("es", "PE"));

        List<Cita> citas = citaRepository.findByDocenteIdOrderByFechaAscHoraInicioAsc(docenteId);

        List<Map<String, Object>> resultado = citas.stream()
                .filter(c -> !c.getFecha().isBefore(hoy))
                .filter(c -> "confirmada".equalsIgnoreCase(c.getEstado())
                          || "pendiente".equalsIgnoreCase(c.getEstado()))
                .map(c -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", c.getId());
                    m.put("ticket", c.getTicket());
                    m.put("estado", c.getEstado());
                    m.put("motivo", c.getMotivo());
                    m.put("fecha", c.getFecha().format(fmt));
                    m.put("hora", c.getHoraInicio() != null
                            ? c.getHoraInicio().toString().substring(0, 5) : "");
                    // Datos del padre
                    if (c.getPadre() != null) {
                        m.put("padre", c.getPadre().getNombre() + " " + c.getPadre().getApellido());
                    }
                    // Datos del estudiante
                    if (c.getEstudiante() != null) {
                        m.put("alumno", c.getEstudiante().getNombre() + " " + c.getEstudiante().getApellido());
                        m.put("grado", c.getEstudiante().getGrado() != null
                                ? c.getEstudiante().getGrado() + " " + (c.getEstudiante().getSeccion() != null ? c.getEstudiante().getSeccion() : "")
                                : "");
                    }
                    return m;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(resultado);
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    private Long extraerDocenteId(HttpServletRequest request) {
        Object attr = request.getAttribute("docenteId");
        if (attr == null) return null;
        return ((Number) attr).longValue();
    }

    private ResponseEntity<?> errorSinVinculo() {
        return ResponseEntity.status(403).body(Map.of(
                "error", "Tu usuario no está vinculado a ningún docente. " +
                         "Contacta al administrador."));
    }
}