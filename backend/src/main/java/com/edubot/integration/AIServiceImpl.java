package com.edubot.integration;

import com.edubot.dto.HorarioSugeridoDTO;
import com.edubot.model.Cita;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.model.Padre;
import com.edubot.repository.CitaRepository;
import com.edubot.repository.DisponibilidadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Component
public class AIServiceImpl implements AIService {

    private static final Logger log = LoggerFactory.getLogger(AIServiceImpl.class);

    @Value("${anthropic.api.key:}")
    private String anthropicApiKey;

    @Value("${anthropic.api.url:https://api.anthropic.com/v1/messages}")
    private String anthropicApiUrl;

    @Value("${anthropic.api.model:claude-3-haiku-20240307}")
    private String anthropicModel;

    private final CitaRepository citaRepository;
    private final DisponibilidadRepository disponibilidadRepository;
    private final RestTemplate restTemplate;

    public AIServiceImpl(CitaRepository citaRepository,
                         DisponibilidadRepository disponibilidadRepository) {
        this.citaRepository = citaRepository;
        this.disponibilidadRepository = disponibilidadRepository;
        this.restTemplate = new RestTemplate();
    }

    // ── sugerirHorarios ───────────────────────────────────────────────────────

    @Override
    public List<HorarioSugeridoDTO> sugerirHorarios(Padre padre, Long docenteId, String motivo) {

        List<DisponibilidadDocente> franjas = disponibilidadRepository
                .findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(docenteId, LocalDate.now());

        if (franjas.isEmpty()) return Collections.emptyList();

        List<Cita> citasExitosas = citaRepository.findCitasExitosasByPadre(padre.getId());

        List<HorarioSugeridoDTO> sugeridos = new ArrayList<>();
        for (DisponibilidadDocente franja : franjas) {
            int score = calcularScore(padre, franja, citasExitosas);
            String razon = generarRazonLocal(padre, franja, citasExitosas, score);
            sugeridos.add(new HorarioSugeridoDTO(
                    franja.getId(), franja.getFecha(),
                    franja.getHoraInicio(), franja.getHoraFin(),
                    score, razon));
        }

        sugeridos.sort(Comparator.comparingInt(HorarioSugeridoDTO::getScore).reversed());
        return sugeridos.subList(0, Math.min(3, sugeridos.size()));
    }

    // ── generarMensajeBienvenida (API real) ───────────────────────────────────

    @Override
    public String generarMensajeBienvenida(String nombrePadre, String motivo) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            log.warn("[AIService] ANTHROPIC_API_KEY no configurada — usando mensaje local.");
            return buildMensajeFallback(nombrePadre, motivo);
        }
        try {
            return llamarAnthropicAPI(nombrePadre, motivo);
        } catch (Exception e) {
            log.error("[AIService] Error llamando a Anthropic API: {}", e.getMessage());
            return buildMensajeFallback(nombrePadre, motivo);
        }
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    private int calcularScore(Padre padre, DisponibilidadDocente franja, List<Cita> citasExitosas) {
        int score = 0;
        score += scoreCompatibilidadHoraria(padre.getHorarioLaboral(), franja.getHoraInicio());
        score += scoreHistorialExitoso(franja.getHoraInicio(), citasExitosas);
        score += scorePopularidad(franja.getHoraInicio());
        score += (franja.getId().intValue() % 5);
        return Math.min(score, 99);
    }

    private int scoreCompatibilidadHoraria(String horarioLaboral, LocalTime hora) {
        if (horarioLaboral == null) return 20;
        return switch (horarioLaboral) {
            case "manana" -> hora.isBefore(LocalTime.of(13, 0)) ? 40 : 10;
            case "tarde"  -> hora.isAfter(LocalTime.of(13, 0)) && hora.isBefore(LocalTime.of(19, 0)) ? 40 : 10;
            case "noche"  -> hora.isAfter(LocalTime.of(17, 0)) ? 40 : 10;
            default       -> 20;
        };
    }

    private int scoreHistorialExitoso(LocalTime hora, List<Cita> citasExitosas) {
        boolean tieneSimilar = citasExitosas.stream()
                .anyMatch(c -> Math.abs(c.getHoraInicio().getHour() - hora.getHour()) <= 1);
        return tieneSimilar ? 35 : 0;
    }

    private int scorePopularidad(LocalTime hora) {
        int h = hora.getHour();
        if (h >= 15 && h <= 17) return 25;
        if (h >= 10 && h <= 12) return 18;
        if (h >= 8  && h <= 9)  return 10;
        return 12;
    }

    private String generarRazonLocal(Padre padre, DisponibilidadDocente franja,
                                     List<Cita> citasExitosas, int score) {
        boolean horarioCompatible = scoreCompatibilidadHoraria(
                padre.getHorarioLaboral(), franja.getHoraInicio()) >= 35;
        boolean tieneHistorial = scoreHistorialExitoso(franja.getHoraInicio(), citasExitosas) > 0;

        if (tieneHistorial && score >= 70)    return "Similar a tu cita anterior exitosa";
        if (horarioCompatible && score >= 65) return "Fuera de tu horario laboral habitual";
        if (score >= 50)                      return "Popular entre padres con trabajo similar";
        return "Opción disponible con buen acceso";
    }

    @Override
    public String generarMensajeRecordatorio(Cita cita, int horasRestantes, long citasAnteriores) {
        String nombrePadre = cita.getPadre().getNombre();
        String nombreDocente = "Prof. " + cita.getDocente().getNombre();
        String hora = cita.getHoraInicio().toString();
        String fecha = cita.getFecha().toString();

        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            return buildRecordatorioFallback(nombrePadre, nombreDocente, hora, horasRestantes, citasAnteriores);
        }
        try {
            String prompt = String.format(
                "Eres EduBot, asistente educativo escolar. Genera un mensaje de recordatorio " +
                "breve y cálido para %s, padre/madre de familia. " +
                "Tiene una cita el %s a las %s con %s. " +
                "Faltan %d hora(s) para la cita. " +
                "Ha tenido %d cita(s) anteriores con este docente. " +
                "%s" +
                "El mensaje debe ser en español, máximo 3 oraciones, amigable y motivador.",
                nombrePadre, fecha, hora, nombreDocente, horasRestantes, citasAnteriores,
                horasRestantes == 1 ? "Recuérdales que lleguen 5 minutos antes. " : ""
            );
            return llamarAnthropicAPIConPrompt(prompt, 150);
        } catch (Exception e) {
            log.error("[AIService] Error generando recordatorio: {}", e.getMessage());
            return buildRecordatorioFallback(nombrePadre, nombreDocente, hora, horasRestantes, citasAnteriores);
        }
    }

    private String buildRecordatorioFallback(String padre, String docente, String hora,
                                              int horas, long citasAnteriores) {
        String prefijo = citasAnteriores > 0
            ? String.format("Hola %s, recuerda tu cita%s con %s",
                padre, citasAnteriores > 1 ? " (la " + (citasAnteriores + 1) + ".ª)" : "", docente)
            : String.format("Hola %s, te recordamos tu primera cita con %s", padre, docente);
        return prefijo + " a las " + hora + ". " +
            (horas == 1 ? "¡Llega 5 minutos antes!" : "¡No olvides asistir!");
    }

    @Override
    public String generarBriefingDocente(Cita cita, List<Cita> citasAnteriores) {
        String nombreEstudiante = cita.getEstudiante() != null
            ? cita.getEstudiante().getNombre() + " " + cita.getEstudiante().getApellido()
            : "el estudiante";
        String motivo = cita.getMotivo();
        int totalCitas = citasAnteriores.size();

        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            return buildBriefingFallback(nombreEstudiante, motivo, totalCitas);
        }
        try {
            String historialResumen = totalCitas == 0
                ? "No hay citas anteriores con este padre."
                : String.format("El padre ha tenido %d cita(s) previas. Motivos anteriores: %s.",
                    totalCitas,
                    citasAnteriores.stream()
                        .map(Cita::getMotivo)
                        .distinct()
                        .reduce((a, b) -> a + ", " + b)
                        .orElse("varios"));

            String prompt = String.format(
                "Eres EduBot. Genera un briefing estructurado en español para un docente " +
                "antes de su reunión con los padres de %s. " +
                "Motivo de la cita: '%s'. %s " +
                "Responde EXACTAMENTE en este formato:\n" +
                "Motivo: [motivo de la cita]\n" +
                "Historial: [resumen del historial en 1 oración]\n" +
                "Puntos sugeridos: [2-3 puntos clave a revisar en la reunión]\n" +
                "No agregues texto adicional fuera de ese formato.",
                nombreEstudiante, motivo, historialResumen
            );
            return llamarAnthropicAPIConPrompt(prompt, 200);
        } catch (Exception e) {
            log.error("[AIService] Error generando briefing: {}", e.getMessage());
            return buildBriefingFallback(nombreEstudiante, motivo, totalCitas);
        }
    }

    private String buildBriefingFallback(String estudiante, String motivo, int totalCitas) {
        return String.format(
            "Motivo: %s\nHistorial: %s\nPuntos sugeridos: Revisar rendimiento académico reciente, " +
            "evaluar asistencia y participación en clase.",
            motivo,
            totalCitas == 0 ? "Primera cita con este padre." :
                totalCitas + " cita(s) anteriores registradas."
        );
    }

    @Override
    public String estructurarActaMinedu(String notasLibres, Cita cita) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            return buildActaFallback(notasLibres, cita);
        }
        try {
            String nombreEstudiante = cita.getEstudiante() != null
                ? cita.getEstudiante().getNombre() + " " + cita.getEstudiante().getApellido()
                : "el estudiante";
            String prompt = String.format(
                "Eres EduBot. Convierte las siguientes notas informales de un docente en un acta " +
                "institucional formal formato MINEDU en español, para la reunión con los padres de %s " +
                "(docente: Prof. %s, motivo: %s). " +
                "Notas del docente: \"%s\"\n\n" +
                "Responde EXACTAMENTE en este formato institucional:\n" +
                "ACUERDOS:\n[lista de acuerdos formales]\n\n" +
                "COMPROMISOS:\n[lista de compromisos del padre y/o estudiante]\n\n" +
                "SEGUIMIENTO:\n[fecha y forma de seguimiento acordada]\n\n" +
                "Usa lenguaje formal institucional. No agregues texto fuera del formato.",
                nombreEstudiante,
                cita.getDocente().getNombre() + " " + cita.getDocente().getApellido(),
                cita.getMotivo(),
                notasLibres
            );
            return llamarAnthropicAPIConPrompt(prompt, 400);
        } catch (Exception e) {
            log.error("[AIService] Error estructurando acta: {}", e.getMessage());
            return buildActaFallback(notasLibres, cita);
        }
    }

    private String buildActaFallback(String notas, Cita cita) {
        return String.format(
            "ACUERDOS:\n- Se tomaron acuerdos sobre el tema: %s.\n- %s\n\n" +
            "COMPROMISOS:\n- El padre/tutor se compromete a dar seguimiento en casa.\n\n" +
            "SEGUIMIENTO:\n- Se realizará un seguimiento en las próximas 4 semanas.",
            cita.getMotivo(), notas
        );
    }

    // ── Helper IA genérico con prompt libre ───────────────────────────────────

    @SuppressWarnings("unchecked")
    private String llamarAnthropicAPIConPrompt(String prompt, int maxTokens) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", anthropicApiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", anthropicModel);
        body.put("max_tokens", maxTokens);
        body.put("messages", List.of(Map.of("role", "user", "content", prompt)));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(anthropicApiUrl, request, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            List<Map<String, Object>> content =
                    (List<Map<String, Object>>) response.getBody().get("content");
            if (content != null && !content.isEmpty()) {
                return content.get(0).get("text").toString().trim();
            }
        }
        throw new RuntimeException("Respuesta vacía de Anthropic API");
    }

    // ── Anthropic API (método original, mantiene compatibilidad) ─────────────

    @SuppressWarnings("unchecked")
    private String llamarAnthropicAPI(String nombrePadre, String motivo) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", anthropicApiKey);
        headers.set("anthropic-version", "2023-06-01");

        String prompt = String.format(
            "Eres EduBot, asistente educativo para una escuela. " +
            "Saluda brevemente y con calidez a %s, padre/madre de familia, " +
            "que quiere agendar una cita con un docente por motivo: \"%s\". " +
            "El mensaje debe ser amigable, en español, máximo 2 oraciones.",
            nombrePadre, motivo);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", anthropicModel);
        body.put("max_tokens", 120);
        body.put("messages", List.of(Map.of("role", "user", "content", prompt)));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(anthropicApiUrl, request, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            List<Map<String, Object>> content =
                    (List<Map<String, Object>>) response.getBody().get("content");
            if (content != null && !content.isEmpty()) {
                return content.get(0).get("text").toString().trim();
            }
        }
        return buildMensajeFallback(nombrePadre, motivo);
    }

    private String buildMensajeFallback(String nombrePadre, String motivo) {
        return String.format(
            "Hola %s, bienvenido a EduBot. Te ayudaremos a agendar tu cita por \"%s\".",
            nombrePadre, motivo);
    }
}