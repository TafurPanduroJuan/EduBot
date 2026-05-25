package com.edubot.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AgendarCitaRequest {
    private Long padreId;
    private Long docenteId;
    private Long disponibilidadId;
    private String motivo;
}
