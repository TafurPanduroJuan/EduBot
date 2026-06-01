package com.edubot.integration;

import com.edubot.dto.HorarioSugeridoDTO;
import com.edubot.model.Cita;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.model.Padre;
import com.edubot.repository.CitaRepository;
import com.edubot.repository.DisponibilidadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Component
public class AIServiceImpl implements AIService {

    private static final Logger log = LoggerFactory.getLogger(AIServiceImpl.class);

    private final CitaRepository citaRepository;
    private final DisponibilidadRepository disponibilidadRepository;

    public AIServiceImpl(CitaRepository citaRepository,
                         DisponibilidadRepository disponibilidadRepository) {
        this.citaRepository = citaRepository;
        this.disponibilidadRepository = disponibilidadRepository;
    }

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

    @Override
    public String generarMensajeBienvenida(String nombrePadre, String motivo) {
        // Placeholder — se conecta a API real en el siguiente commit
        return String.format(
            "Hola %s, bienvenido a EduBot. Te ayudaremos a agendar tu cita por \"%s\".",
            nombrePadre, motivo);
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
}