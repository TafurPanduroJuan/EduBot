package com.edubot.service;

import com.edubot.dto.HorarioSugeridoDTO;
import com.edubot.model.Cita;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.model.Padre;
import com.edubot.repository.CitaRepository;
import com.edubot.repository.DisponibilidadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * IaPrediccionService — "IA Simulada" de EduBot
 *
 * Implementa un algoritmo de scoring determinístico que simula
 * predicción inteligente. Analiza 3 señales:
 *
 *  1. COMPATIBILIDAD HORARIA (40%): el horario disponible coincide
 *     con el turno laboral habitual del padre (mañana/tarde/noche).
 *
 *  2. HISTORIAL EXITOSO (35%): si el padre ya asistió exitosamente
 *     a una cita en un horario similar, se sube el score.
 *
 *  3. POPULARIDAD (25%): horarios con más citas completadas entre
 *     todos los padres tienen un bonus de popularidad.
 */
@Service
public class IaPrediccionService {

    @Autowired
    private CitaRepository citaRepository;

    @Autowired
    private DisponibilidadRepository disponibilidadRepository;

    /**
     * Devuelve los 3 mejores horarios sugeridos para el padre con el docente dado.
     *
     * @param padre       Padre de familia solicitante
     * @param docenteId   ID del docente deseado
     * @param motivo      Motivo de la cita (rendimiento, conducta, salud, otro)
     * @return Lista ordenada de HorarioSugeridoDTO con score y razón
     */
    public List<HorarioSugeridoDTO> sugerirHorarios(Padre padre, Long docenteId, String motivo) {

        // 1. Obtener franjas disponibles del docente (próximos 7 días)
        List<DisponibilidadDocente> franjas = disponibilidadRepository
                .findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(docenteId, LocalDate.now());

        if (franjas.isEmpty()) {
            return Collections.emptyList();
        }

        // 2. Obtener historial de citas exitosas del padre
        List<Cita> citasExitosas = citaRepository.findCitasExitosasByPadre(padre.getId());

        // 3. Puntuar cada franja
        List<HorarioSugeridoDTO> sugeridos = new ArrayList<>();
        for (DisponibilidadDocente franja : franjas) {
            int score = calcularScore(padre, franja, citasExitosas, docenteId);
            String razon = generarRazon(padre, franja, citasExitosas, score);

            sugeridos.add(new HorarioSugeridoDTO(
                    franja.getId(),
                    franja.getFecha(),
                    franja.getHoraInicio(),
                    franja.getHoraFin(),
                    score,
                    razon
            ));
        }

        // 4. Ordenar por score descendente y devolver top 3
        sugeridos.sort(Comparator.comparingInt(HorarioSugeridoDTO::getScore).reversed());
        return sugeridos.subList(0, Math.min(3, sugeridos.size()));
    }

    // ── Scoring ──────────────────────────────────────────────────────────────

    private int calcularScore(Padre padre, DisponibilidadDocente franja,
                               List<Cita> citasExitosas, Long docenteId) {
        int score = 0;

        // Señal 1: compatibilidad con horario laboral (0-40 puntos)
        score += scoreCompatibilidadHoraria(padre.getHorarioLaboral(), franja.getHoraInicio());

        // Señal 2: coincide con horario de citas exitosas previas (0-35 puntos)
        score += scoreHistorialExitoso(franja.getHoraInicio(), citasExitosas);

        // Señal 3: popularidad del horario (0-25 puntos)
        score += scorePopularidad(franja.getHoraInicio());

        // Pequeña variación pseudoaleatoria determinista para evitar empates exactos
        score += (franja.getId().intValue() % 5);

        return Math.min(score, 99); // máximo 99%
    }

    private int scoreCompatibilidadHoraria(String horarioLaboral, LocalTime hora) {
        if (horarioLaboral == null) return 20; // neutral
        return switch (horarioLaboral) {
            case "manana"  -> hora.isBefore(LocalTime.of(13, 0)) ? 40 : 10;
            case "tarde"   -> hora.isAfter(LocalTime.of(13, 0)) && hora.isBefore(LocalTime.of(19, 0)) ? 40 : 10;
            case "noche"   -> hora.isAfter(LocalTime.of(17, 0)) ? 40 : 10;
            default        -> 20;
        };
    }

    private int scoreHistorialExitoso(LocalTime hora, List<Cita> citasExitosas) {
        // Si alguna cita exitosa fue en una franja similar (±1 hora)
        boolean tieneHistorialSimilar = citasExitosas.stream()
                .anyMatch(c -> Math.abs(c.getHoraInicio().getHour() - hora.getHour()) <= 1);
        return tieneHistorialSimilar ? 35 : 0;
    }

    private int scorePopularidad(LocalTime hora) {
        // Horarios "pico" de padres trabajadores — heurística fija simulada
        int h = hora.getHour();
        if (h >= 15 && h <= 17) return 25; // tarde media: muy popular
        if (h >= 10 && h <= 12) return 18; // media mañana: popular
        if (h >= 8  && h <= 9)  return 10; // temprano: menos popular
        return 12; // resto
    }

    // ── Generación de razón legible para el usuario ───────────────────────────

    private String generarRazon(Padre padre, DisponibilidadDocente franja,
                                 List<Cita> citasExitosas, int score) {
        // Priorizar la señal más fuerte
        boolean horarioCompatible = scoreCompatibilidadHoraria(
                padre.getHorarioLaboral(), franja.getHoraInicio()) >= 35;
        boolean tieneHistorial = scoreHistorialExitoso(franja.getHoraInicio(), citasExitosas) > 0;

        if (tieneHistorial && score >= 70) {
            return "Similar a tu cita anterior exitosa";
        } else if (horarioCompatible && score >= 65) {
            return "Fuera de tu horario laboral habitual";
        } else if (score >= 50) {
            return "Popular entre padres con trabajo similar";
        } else {
            return "Opción disponible con buen acceso";
        }
    }
}
