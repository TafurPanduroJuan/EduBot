package com.edubot.controller;

import com.edubot.dto.HorarioSugeridoDTO;
import com.edubot.model.*;
import com.edubot.repository.*;
import com.edubot.service.IaPrediccionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/edubot")
public class ChatBotController {

    @Autowired private PadreRepository padreRepository;
    @Autowired private DocenteRepository docenteRepository;
    @Autowired private EstudianteRepository estudianteRepository;
    @Autowired private CitaRepository citaRepository;
    @Autowired private DisponibilidadRepository disponibilidadRepository;
    @Autowired private IaPrediccionService iaService;

    // ── Health check ──────────────────────────────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "EduBot API"));
    }

    // ── 1. Validar padre por DNI ──────────────────────────────────────────────
    @GetMapping("/padre/{dni}")
    public ResponseEntity<?> validarPadre(@PathVariable String dni) {
        return padreRepository.findByDni(dni)
                .map(padre -> {
                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("id", padre.getId());
                    resp.put("nombre", padre.getNombre());
                    resp.put("apellido", padre.getApellido());
                    List<Estudiante> hijos = estudianteRepository.findByPadreId(padre.getId());
                    if (!hijos.isEmpty()) {
                        Estudiante hijo = hijos.get(0);
                        resp.put("nombreEstudiante", hijo.getNombre() + " " + hijo.getApellido());
                        resp.put("gradoEstudiante", hijo.getGrado() + " " + hijo.getSeccion());
                    }
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── 2. Listar docentes ────────────────────────────────────────────────────
    @GetMapping("/docentes")
    public ResponseEntity<?> listarDocentes() {
        List<Docente> docentes = docenteRepository.findByActivoTrue();
        List<Map<String, Object>> resultado = docentes.stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("nombre", "Prof. " + d.getNombre());
            m.put("curso", d.getCurso());
            return m;
        }).toList();
        return ResponseEntity.ok(resultado);
    }

    // ── 3. Horarios con IA ────────────────────────────────────────────────────
    @GetMapping("/horarios")
    public ResponseEntity<?> obtenerHorarios(
            @RequestParam Long padreId,
            @RequestParam Long docenteId,
            @RequestParam(defaultValue = "rendimiento") String motivo) {

        Padre padre = padreRepository.findById(padreId).orElse(null);
        if (padre == null) return ResponseEntity.notFound().build();

        List<HorarioSugeridoDTO> sugerencias = iaService.sugerirHorarios(padre, docenteId, motivo);

        List<DisponibilidadDocente> todos = disponibilidadRepository
                .findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(docenteId, LocalDate.now());

        List<Map<String, Object>> todosFormateados = todos.stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("disponibilidadId", d.getId());
            m.put("fecha", d.getFecha());
            m.put("horaInicio", d.getHoraInicio());
            m.put("horaFin", d.getHoraFin());
            return m;
        }).toList();

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("sugerenciasIA", sugerencias);
        resp.put("todosLosHorarios", todosFormateados);

        return ResponseEntity.ok(resp);
    }

    // ── 4. Confirmar cita ─────────────────────────────────────────────────────
    @PostMapping("/cita")
    public ResponseEntity<?> confirmarCita(@RequestBody Map<String, Object> body) {
        try {
            // Validar que todos los campos requeridos estén presentes
            String[] required = {"padreId", "docenteId", "disponibilidadId", "motivo"};
            for (String field : required) {
                if (body.get(field) == null) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Campo requerido faltante: " + field));
                }
            }

            Long padreId   = Long.parseLong(body.get("padreId").toString());
            Long docenteId = Long.parseLong(body.get("docenteId").toString());
            Long dispId    = Long.parseLong(body.get("disponibilidadId").toString());
            String motivo  = body.get("motivo").toString();

            Padre padre     = padreRepository.findById(padreId).orElseThrow(
                    () -> new RuntimeException("Padre no encontrado con id: " + padreId));
            Docente docente = docenteRepository.findById(docenteId).orElseThrow(
                    () -> new RuntimeException("Docente no encontrado con id: " + docenteId));
            DisponibilidadDocente disp = disponibilidadRepository.findById(dispId).orElseThrow(
                    () -> new RuntimeException("Horario no encontrado con id: " + dispId));

            if (!disp.isDisponible()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "El horario ya no está disponible. Por favor elige otro."));
            }

            disp.setDisponible(false);
            disponibilidadRepository.save(disp);

            Cita cita = new Cita();
            cita.setTicket("EDU-" + String.format("%04d", (int)(Math.random() * 9000 + 1000)));
            cita.setPadre(padre);
            cita.setDocente(docente);
            cita.setFecha(disp.getFecha());
            cita.setHoraInicio(disp.getHoraInicio());
            cita.setHoraFin(disp.getHoraFin());
            cita.setMotivo(motivo);
            cita.setEstado("confirmada");
            citaRepository.save(cita);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("ticket", cita.getTicket());
            resp.put("citaId", cita.getId());
            resp.put("docente", "Prof. " + docente.getNombre());
            resp.put("curso", docente.getCurso());
            resp.put("fecha", cita.getFecha());
            resp.put("horaInicio", cita.getHoraInicio());
            resp.put("horaFin", cita.getHoraFin());
            resp.put("motivo", motivo);
            resp.put("mensaje", "¡Cita confirmada! Recibirás recordatorio 24h y 1h antes.");

            return ResponseEntity.ok(resp);

        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "ID inválido: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── 5. Historial de citas ─────────────────────────────────────────────────
    @GetMapping("/citas/{padreId}")
    public ResponseEntity<?> historialCitas(@PathVariable Long padreId) {
        if (!padreRepository.existsById(padreId)) {
            return ResponseEntity.notFound().build();
        }
        List<Cita> citas = citaRepository.findByPadreIdOrderByFechaDesc(padreId);
        List<Map<String, Object>> resultado = citas.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("ticket", c.getTicket());
            m.put("docente", "Prof. " + c.getDocente().getNombre());
            m.put("curso", c.getDocente().getCurso());
            m.put("fecha", c.getFecha());
            m.put("horaInicio", c.getHoraInicio());
            m.put("horaFin", c.getHoraFin());
            m.put("motivo", c.getMotivo());
            m.put("estado", c.getEstado());
            return m;
        }).toList();
        return ResponseEntity.ok(resultado);
    }

    // ── 6. Cancelar cita ──────────────────────────────────────────────────────
    @PatchMapping("/cita/{citaId}/cancelar")
    public ResponseEntity<?> cancelarCita(
            @PathVariable Long citaId,
            @RequestBody Map<String, Object> body) {
        try {
            if (body.get("padreId") == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "padreId requerido"));
            }
            Long padreId = Long.parseLong(body.get("padreId").toString());

            Cita cita = citaRepository.findById(citaId).orElse(null);
            if (cita == null) return ResponseEntity.notFound().build();

            if (!cita.getPadre().getId().equals(padreId)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "No tienes permiso para cancelar esta cita."));
            }

            if ("cancelada".equals(cita.getEstado()) || "completada".equals(cita.getEstado())) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Esta cita ya no puede cancelarse (estado: " + cita.getEstado() + ")."));
            }

            cita.setEstado("cancelada");
            citaRepository.save(cita);

            return ResponseEntity.ok(Map.of(
                    "mensaje", "Cita cancelada correctamente.",
                    "ticket", cita.getTicket(),
                    "estado", "cancelada"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
