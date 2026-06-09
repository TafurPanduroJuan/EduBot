package com.edubot.controller;

import com.edubot.integration.AIService;
import com.edubot.model.Cita;
import com.edubot.repository.CitaRepository;
import com.edubot.service.ActaPdfService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/edubot/cita")
public class CitaContextoController {

    private final CitaRepository citaRepository;
    private final AIService aiService;
    private final ActaPdfService actaPdfService;

    public CitaContextoController(CitaRepository citaRepository,
                                   AIService aiService,
                                   ActaPdfService actaPdfService) {
        this.citaRepository  = citaRepository;
        this.aiService       = aiService;
        this.actaPdfService  = actaPdfService;
    }


    /**
     * GET /api/edubot/cita/{id}/contexto
     *
     * La IA recibe motivo + historial del estudiante y devuelve un briefing
     * estructurado para que el docente se prepare antes de la reunión.
     *
     * Requiere: Token JWT con rol DOCENTE o ADMINISTRATIVO.
     *
     * Response 200:
     * {
     *   "citaId": 12,
     *   "ticket": "EDU-3421",
     *   "padre": "Rosa López",
     *   "estudiante": "Carlos López",
     *   "motivo": "rendimiento",
     *   "fecha": "2025-06-10",
     *   "briefingIA": "Motivo: rendimiento\nÚltima nota: 08...\nPuntos sugeridos: ..."
     * }
     */
    @GetMapping("/{id}/contexto")
    public ResponseEntity<?> obtenerContexto(@PathVariable Long id) {
        Cita cita = citaRepository.findById(id).orElse(null);
        if (cita == null) {
            return ResponseEntity.notFound().build();
        }

        // Historial del padre con el mismo docente (excluye la cita actual)
        List<Cita> historial = citaRepository
            .findByPadreIdAndDocenteIdOrderByFechaDesc(
                cita.getPadre().getId(),
                cita.getDocente().getId()
            )
            .stream()
            .filter(c -> !c.getId().equals(id))
            .toList();

        // Llamada a IA para generar el briefing
        String briefingIA = aiService.generarBriefingDocente(cita, historial);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("citaId",    cita.getId());
        resp.put("ticket",    cita.getTicket());
        resp.put("padre",     cita.getPadre().getNombre() + " " + cita.getPadre().getApellido());
        resp.put("estudiante", cita.getEstudiante() != null
            ? cita.getEstudiante().getNombre() + " " + cita.getEstudiante().getApellido()
            : "No registrado");
        resp.put("grado", cita.getEstudiante() != null
            ? cita.getEstudiante().getGrado() + " " + cita.getEstudiante().getSeccion()
            : "");
        resp.put("motivo",    cita.getMotivo());
        resp.put("fecha",     cita.getFecha());
        resp.put("horaInicio", cita.getHoraInicio());
        resp.put("citasAnteriores", historial.size());
        resp.put("briefingIA", briefingIA);

        return ResponseEntity.ok(resp);
    }


    /**
     * POST /api/edubot/cita/{id}/acta
     *
     * El docente envía sus notas en texto libre.
     * La IA las estructura en formato MINEDU (Acuerdos / Compromisos / Seguimiento).
     * Se genera un PDF con iText y se guarda en el servidor.
     * Se retorna la URL de descarga.
     *
     * Body: { "notasLibres": "le dije al papá que estudie más..." }
     *
     * Response 200:
     * {
     *   "ticket": "EDU-3421",
     *   "actaEstructurada": "ACUERDOS:\n...\nCOMPROMISOS:\n...\nSEGUIMIENTO:\n...",
     *   "urlDescarga": "http://localhost:8080/actas/EDU-3421.pdf",
     *   "mensaje": "Acta generada y archivada correctamente."
     * }
     */
    @PostMapping("/{id}/acta")
    public ResponseEntity<?> generarActa(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        String notasLibres = body.get("notasLibres");
        if (notasLibres == null || notasLibres.isBlank()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "El campo 'notasLibres' es requerido."));
        }

        Cita cita = citaRepository.findById(id).orElse(null);
        if (cita == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            // 1. IA estructura el texto libre en formato MINEDU
            String actaEstructurada = aiService.estructurarActaMinedu(notasLibres, cita);

            // 2. Generar PDF con iText y obtener URL de descarga
            String urlDescarga = actaPdfService.generarPdf(cita, actaEstructurada);

            // 3. Marcar la cita como completada si aún estaba confirmada
            if ("confirmada".equals(cita.getEstado())) {
                cita.setEstado("completada");
                citaRepository.save(cita);
            }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("ticket",           cita.getTicket());
            resp.put("actaEstructurada", actaEstructurada);
            resp.put("urlDescarga",      urlDescarga);
            resp.put("mensaje",          "Acta generada y archivada correctamente.");

            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Error generando el acta: " + e.getMessage()));
        }
    }

    // ── Descarga directa del PDF ───────────────────────────────────────────────

    /**
     * GET /api/edubot/cita/actas/{filename}
     * Sirve el archivo PDF generado para descarga directa.
     */
    @GetMapping("/actas/{filename:.+}")
    public ResponseEntity<Resource> descargarActa(@PathVariable String filename) {
        try {
            Path filePath = actaPdfService.resolverRuta(filename);
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + filename + "\"")
                .body(resource);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
