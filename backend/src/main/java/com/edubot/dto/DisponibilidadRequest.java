package com.edubot.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
public class DisponibilidadRequest {

    /** Lista de bloques a crear/actualizar para la semana */
    @NotNull
    private List<BloqueDTO> bloques;

    /** Si true, borra todos los bloques futuros antes de insertar */
    private boolean reemplazarExistentes = false;

    @Data
    public static class BloqueDTO {
        @NotNull private LocalDate fecha;
        @NotNull private LocalTime horaInicio;
        @NotNull private LocalTime horaFin;
    }
}
