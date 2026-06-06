package com.edubot.controller;

import com.edubot.dto.LoginRequest;
import com.edubot.dto.LoginResponse;
import com.edubot.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AuthController — endpoints de autenticación del panel EduBot.
 *
 * POST /api/panel/auth/login  → devuelve JWT con rol y docenteId
 */
@RestController
@RequestMapping("/api/panel/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Login del panel.
     * Devuelve token JWT, rol y datos del docente si aplica.
     *
     * Body: { "username": "...", "password": "..." }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        try {
            LoginResponse resp = authService.login(req);
            return ResponseEntity.ok(resp);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }
}
