package com.edubot.controller;

import com.edubot.dto.DisponibilidadRequest;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.service.DisponibilidadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * DocentePanelController — endpoints del panel exclusivos para DOCENTES.
 *
 * Todas las rutas bajo /api/panel/docente/** requieren rol DOCENTE.
 * La validación ocurre en dos capas:
 *   1. SecurityConfig rechaza el request si no tiene rol DOCENTE.
 *   2. El controller verifica que el docenteId del token coincida
 *      con el recurso solicitado (un docente no puede ver los datos de otro).
 *
 * HU004 — Configuración de bloques de atención del docente.
 */
@RestController
@RequestMapping("/api/panel/docente")
@PreAuthorize("hasRole('DOCENTE')")
public class DocentePanelController {

    private final DisponibilidadService disponibilidadService;

    public DocentePanelController(DisponibilidadService disponibilidadService) {
        this.disponibilidadService = disponibilidadService;
    }

    // ── HU004: Ver disponibilidad propia ──────────────────────────────────────

    /**
     * GET /api/panel/docente/disponibilidad
     * Devuelve los bloques del docente autenticado para los próximos 14 días.
     */
    @GetMapping("/disponibilidad")
    public ResponseEntity<?> obtenerDisponibilidad(HttpServletRequest request) {
        Long docenteId = extraerDocenteId(request);
        if (docenteId == null) return errorSinVinculo();

        List<DisponibilidadDocente> bloques =
                disponibilidadService.obtenerDisponibilidad(docenteId);

        return ResponseEntity.ok(bloques);
    }

    // ── HU004: Guardar disponibilidad ─────────────────────────────────────────

    /**
     * POST /api/panel/docente/disponibilidad
     * El docente configura sus bloques de atención para la semana.
     *
     * Body: { "bloques": [...], "reemplazarExistentes": true/false }
     */
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

    // ── HU004: Sugerencia de bloques con IA ──────────────────────────────────

    /**
     * GET /api/panel/docente/disponibilidad/sugerir
     * La IA analiza el historial del docente y propone los mejores bloques
     * para la siguiente semana.
     *
     * Response: { "mensajeIA": "...", "bloquesSugeridos": [...] }
     */
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

    // ── Helper: extraer docenteId del JWT (puesto por JwtAuthFilter) ──────────

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
