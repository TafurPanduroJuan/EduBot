package com.edubot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Request body para POST /api/panel/auth/login */
@Data
public class LoginRequest {

    @NotBlank(message = "El username es requerido")
    private String username;

    @NotBlank(message = "La contraseña es requerida")
    private String password;
}
