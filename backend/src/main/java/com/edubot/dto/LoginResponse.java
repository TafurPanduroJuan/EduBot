package com.edubot.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Response de POST /api/panel/auth/login */
@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String username;
    private String rol;           // "DOCENTE" o "ADMINISTRATIVO"
    private Long   docenteId;     // null si es ADMINISTRATIVO
    private String nombreDocente; // null si es ADMINISTRATIVO
}
