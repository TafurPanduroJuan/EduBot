package com.edubot.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class HorarioSugeridoDTO {
    private Long disponibilidadId;
    private LocalDate fecha;
    private LocalTime horaInicio;
    private LocalTime horaFin;
    private int score;
    private String razon;
}
