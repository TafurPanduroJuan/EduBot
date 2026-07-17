        package com.edubot.service;

        import com.edubot.dto.DisponibilidadRequest;
        import com.edubot.model.Docente;
        import com.edubot.model.DisponibilidadDocente;
        import com.edubot.repository.CitaRepository;
        import com.edubot.repository.DisponibilidadRepository;
        import com.edubot.repository.DocenteRepository;
        import org.slf4j.Logger;
        import org.slf4j.LoggerFactory;
        import org.springframework.beans.factory.annotation.Value;
        import org.springframework.http.*;
        import org.springframework.stereotype.Service;
        import org.springframework.transaction.annotation.Transactional;
        import org.springframework.web.client.RestTemplate;

        import java.time.DayOfWeek;
        import java.time.LocalDate;
        import java.time.LocalTime;
        import java.util.*;
        import java.util.stream.Collectors;

        /**
         * DisponibilidadService — gestiona los bloques de atención del docente (HU004).
         *
         * Incluye la llamada a la IA (Anthropic) para sugerir bloques óptimos
         * basándose en el historial de citas completadas del docente.
         */
        @Service
        public class DisponibilidadService {

            private static final Logger log = LoggerFactory.getLogger(DisponibilidadService.class);

            private final DisponibilidadRepository dispRepo;
            private final DocenteRepository docenteRepo;
            private final CitaRepository citaRepo;
            private final RestTemplate restTemplate = new RestTemplate();

            @Value("${anthropic.api.key:}")
            private String anthropicApiKey;

            @Value("${anthropic.api.url:https://api.anthropic.com/v1/messages}")
            private String anthropicUrl;

            @Value("${anthropic.api.model:claude-3-haiku-20240307}")
            private String anthropicModel;

            public DisponibilidadService(DisponibilidadRepository dispRepo,
                                        DocenteRepository docenteRepo,
                                        CitaRepository citaRepo) {
                this.dispRepo    = dispRepo;
                this.docenteRepo = docenteRepo;
                this.citaRepo    = citaRepo;
            }

            // ── Consultar disponibilidad ──────────────────────────────────────────────

            /**
             * Devuelve todos los bloques del docente para los próximos 14 días.
             */
            public List<DisponibilidadDocente> obtenerDisponibilidad(Long docenteId) {
                LocalDate hoy   = LocalDate.now();
                LocalDate hasta = hoy.plusDays(14);
                return dispRepo.findByDocenteIdAndFechaBetweenOrderByFechaAscHoraInicioAsc(
                        docenteId, hoy, hasta);
            }

            // ── Guardar disponibilidad (HU004) ────────────────────────────────────────

            /**
             * Guarda los bloques de disponibilidad que configuró el docente.
             * Si reemplazarExistentes=true, elimina los bloques futuros antes de insertar.
             */
            @Transactional
            public List<DisponibilidadDocente> guardarDisponibilidad(Long docenteId,
                                                                    DisponibilidadRequest req) {
                Docente docente = docenteRepo.findById(docenteId)
                        .orElseThrow(() -> new RuntimeException("Docente no encontrado: " + docenteId));

                if (req.isReemplazarExistentes()) {
                    // Solo se borran los bloques que siguen LIBRES; los que ya
                    // tienen una cita confirmada (disponible=false) se preservan.
                    dispRepo.deleteByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(
                            docenteId, LocalDate.now());
                }

                List<DisponibilidadDocente> creados = new ArrayList<>();
                for (DisponibilidadRequest.BloqueDTO bloque : req.getBloques()) {
                    DisponibilidadDocente d = new DisponibilidadDocente();
                    d.setDocente(docente);
                    d.setFecha(bloque.getFecha());
                    d.setHoraInicio(bloque.getHoraInicio());
                    d.setHoraFin(bloque.getHoraFin());
                    d.setDisponible(true);
                    creados.add(dispRepo.save(d));
                }

                log.info("[Disponibilidad] Docente {} guardó {} bloques", docenteId, creados.size());
                return creados;
            }

            // ── Sugerencia IA (HU004) ─────────────────────────────────────────────────

            /**
             * Llama a la IA para sugerir bloques óptimos para la próxima semana,
             * basándose en el historial de citas del docente.
             *
             * Devuelve una lista de BloqueDTO sugeridos + un mensaje explicativo.
             */
            public Map<String, Object> sugerirBloques(Long docenteId) {
                Docente docente = docenteRepo.findById(docenteId)
                        .orElseThrow(() -> new RuntimeException("Docente no encontrado: " + docenteId));

                // Contexto: bloques usados en los últimos 30 días
                List<DisponibilidadDocente> historial = dispRepo
                        .findByDocenteIdAndFechaGreaterThanEqual(docenteId,
                                LocalDate.now().minusDays(30));

                // Construir resumen del historial para la IA
                String resumenHistorial = construirResumenHistorial(historial);

                String mensajeIA;
                List<Map<String, String>> bloquesSugeridos;

                if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
                    log.warn("[IA] API key no configurada — usando sugerencia local");
                    mensajeIA      = sugerenciaLocal(docente.getNombre());
                    bloquesSugeridos = bloquesPorDefecto(historial, docenteId);
                } else {
                    try {
                        mensajeIA      = llamarAnthropicSugerencia(docente.getNombre(), resumenHistorial);
                        bloquesSugeridos = bloquesPorDefecto(historial, docenteId);
                    } catch (Exception e) {
                        log.error("[IA] Error llamando Anthropic: {}", e.getMessage());
                        mensajeIA      = sugerenciaLocal(docente.getNombre());
                        bloquesSugeridos = bloquesPorDefecto(historial, docenteId);
                    }
                }

                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("mensajeIA", mensajeIA);
                resp.put("bloquesSugeridos", bloquesSugeridos);
                return resp;
            }

            // ── Helpers privados ──────────────────────────────────────────────────────

            private String construirResumenHistorial(List<DisponibilidadDocente> historial) {
                if (historial.isEmpty()) return "Sin historial previo.";

                Map<String, Integer> conteoHoras = new TreeMap<>();
                for (DisponibilidadDocente d : historial) {
                    String hora = d.getHoraInicio().toString();
                    conteoHoras.merge(hora, 1, Integer::sum);
                }

                StringBuilder sb = new StringBuilder("Bloques más usados: ");
                conteoHoras.entrySet().stream()
                        .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                        .limit(5)
                        .forEach(e -> sb.append(e.getKey()).append(" (").append(e.getValue()).append(" veces), "));

                return sb.toString();
            }

            @SuppressWarnings("unchecked")
            private String llamarAnthropicSugerencia(String nombreDocente, String resumenHistorial) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("x-api-key", anthropicApiKey);
                headers.set("anthropic-version", "2023-06-01");

                String prompt = String.format("""
                    Eres EduBot, asistente para docentes de colegios públicos del Perú.
                    El docente %s quiere configurar sus horarios de atención a padres para la próxima semana.
                    
                    Historial reciente: %s
                    
                    Sugiere en 2-3 oraciones amigables qué días y franjas horarias serían ideales,
                    considerando que los padres trabajadores prefieren tardes (3pm-6pm) y que el docente
                    tiene clases en las mañanas. Sé específico y breve.
                    """, nombreDocente, resumenHistorial);

                Map<String, Object> body = new LinkedHashMap<>();
                body.put("model", anthropicModel);
                body.put("max_tokens", 200);
                body.put("messages", List.of(Map.of("role", "user", "content", prompt)));

                HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, headers);
                ResponseEntity<Map> resp = restTemplate.postForEntity(anthropicUrl, req, Map.class);

                if (resp.getStatusCode() == HttpStatus.OK && resp.getBody() != null) {
                    List<Map<String, Object>> content =
                            (List<Map<String, Object>>) resp.getBody().get("content");
                    if (content != null && !content.isEmpty()) {
                        return content.get(0).get("text").toString().trim();
                    }
                }
                return sugerenciaLocal(nombreDocente);
            }

            private String sugerenciaLocal(String nombreDocente) {
                return String.format(
                    "Hola Prof. %s, basándonos en las preferencias típicas de los padres, " +
                    "te sugerimos habilitar bloques los martes y jueves de 3:00pm a 5:00pm, " +
                    "y los miércoles de 4:00pm a 6:00pm. Estos horarios tienen la mayor " +
                    "tasa de asistencia entre padres trabajadores.", nombreDocente);
            }

            /**
             * Bloques recomendados para la próxima semana.
             *
             * A diferencia de la versión anterior (que devolvía siempre
             * martes/miércoles/jueves a las mismas horas fijas para
             * cualquier docente), esta versión:
             *  1) Prioriza las horas más usadas por ESE docente en su
             *     historial reciente (si existe).
             *  2) Si no hay historial, elige horas variadas de un pool
             *     típico de tarde, con orden aleatorio.
             *  3) Elige 3 días hábiles distintos al azar dentro de los
             *     próximos 10 días hábiles, evitando bloques que el
             *     docente ya tenga registrados, para que cada llamada
             *     a "Sugerir con IA" no repita siempre el mismo patrón.
             */
            private List<Map<String, String>> bloquesPorDefecto(
                    List<DisponibilidadDocente> historial, Long docenteId) {

                List<LocalTime> horasCandidatas = obtenerHorasSugeridas(historial);

                Set<LocalDate> fechasYaRegistradas = dispRepo
                        .findByDocenteIdAndFechaGreaterThanEqual(docenteId, LocalDate.now())
                        .stream()
                        .map(DisponibilidadDocente::getFecha)
                        .collect(Collectors.toSet());

                List<LocalDate> diasHabilesDisponibles = new ArrayList<>();
                LocalDate cursor = LocalDate.now().plusDays(1);
                while (diasHabilesDisponibles.size() < 8
                        && cursor.isBefore(LocalDate.now().plusDays(20))) {
                    DayOfWeek dow = cursor.getDayOfWeek();
                    boolean esHabil = dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
                    if (esHabil && !fechasYaRegistradas.contains(cursor)) {
                        diasHabilesDisponibles.add(cursor);
                    }
                    cursor = cursor.plusDays(1);
                }

                Collections.shuffle(diasHabilesDisponibles);
                List<LocalDate> diasElegidos = diasHabilesDisponibles
                        .subList(0, Math.min(3, diasHabilesDisponibles.size()));
                diasElegidos.sort(Comparator.naturalOrder());

                List<Map<String, String>> bloques = new ArrayList<>();
                for (int i = 0; i < diasElegidos.size(); i++) {
                    LocalTime inicio = horasCandidatas.get(i % horasCandidatas.size());
                    LocalTime fin = inicio.plusHours(2);
                    bloques.add(bloque(diasElegidos.get(i), inicio.toString(), fin.toString()));
                }
                return bloques;
            }

            /** Devuelve las horas más usadas por el docente, o un pool variado si no hay historial. */
            private List<LocalTime> obtenerHorasSugeridas(List<DisponibilidadDocente> historial) {
                if (historial != null && !historial.isEmpty()) {
                    List<LocalTime> masUsadas = historial.stream()
                            .collect(Collectors.groupingBy(
                                    DisponibilidadDocente::getHoraInicio, Collectors.counting()))
                            .entrySet().stream()
                            .sorted(Map.Entry.<LocalTime, Long>comparingByValue().reversed())
                            .map(Map.Entry::getKey)
                            .limit(3)
                            .collect(Collectors.toList());
                    if (!masUsadas.isEmpty()) return masUsadas;
                }

                // Sin historial: pool de horas típicas de tarde (preferidas por padres
                // trabajadores), mezclado al azar para no repetir siempre el mismo patrón.
                List<LocalTime> pool = new ArrayList<>(List.of(
                        LocalTime.of(15, 0), LocalTime.of(16, 0), LocalTime.of(17, 0),
                        LocalTime.of(10, 0), LocalTime.of(14, 0)));
                Collections.shuffle(pool);
                return pool.subList(0, 3);
            }

            private Map<String, String> bloque(LocalDate fecha, String inicio, String fin) {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("fecha", fecha.toString());
                m.put("horaInicio", inicio);
                m.put("horaFin", fin);
                return m;
            }
        }
