package com.edubot.controller;

import com.edubot.dto.LoginRequest;
import com.edubot.dto.LoginResponse;
import com.edubot.model.UsuarioPanel;
import com.edubot.repository.DocenteRepository;
import com.edubot.repository.UsuarioPanelRepository;
import com.edubot.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AuthController — endpoints de autenticación del panel EduBot.
 *
 * POST /api/panel/auth/login            → devuelve JWT con rol y docenteId
 * POST /api/panel/auth/crear-docente    → crea usuario_panel para un docente (solo ADMIN)
 * GET  /api/panel/auth/usuarios         → lista usuarios_panel (solo ADMIN)
 * POST /api/panel/auth/sincronizar      → crea usuarios para todos los docentes sin usuario (solo ADMIN)
 */
@RestController
@RequestMapping("/api/panel/auth")
public class AuthController {

    private final AuthService authService;
    private final UsuarioPanelRepository usuarioRepo;
    private final DocenteRepository docenteRepo;

    public AuthController(AuthService authService,
                          UsuarioPanelRepository usuarioRepo,
                          DocenteRepository docenteRepo) {
        this.authService = authService;
        this.usuarioRepo = usuarioRepo;
        this.docenteRepo = docenteRepo;
    }

    /**
     * Login del panel.
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

    /**
     * Crea un usuario DOCENTE vinculado a un docente existente.
     * Solo accesible para ADMINISTRATIVO.
     *
     * Body: { "username": "juan.perez", "password": "pass123", "docenteId": 5 }
     */
    @PostMapping("/crear-docente")
    @PreAuthorize("hasRole('ADMINISTRATIVO')")
    public ResponseEntity<?> crearUsuarioDocente(@RequestBody Map<String, Object> body) {
        try {
            String username  = (String) body.get("username");
            String password  = (String) body.get("password");
            Long docenteId   = Long.valueOf(body.get("docenteId").toString());

            UsuarioPanel u = authService.crearUsuarioDocente(username, password, docenteId);

            return ResponseEntity.ok(Map.of(
                    "mensaje", "Usuario creado correctamente.",
                    "username", u.getUsername(),
                    "docenteId", docenteId
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Crea un usuario ADMINISTRATIVO.
     * Solo accesible para ADMINISTRATIVO.
     *
     * Body: { "username": "nueva.admin", "password": "pass123" }
     */
    @PostMapping("/crear-admin")
    @PreAuthorize("hasRole('ADMINISTRATIVO')")
    public ResponseEntity<?> crearUsuarioAdmin(@RequestBody Map<String, Object> body) {
        try {
            String username = (String) body.get("username");
            String password = (String) body.get("password");

            UsuarioPanel u = authService.crearUsuarioAdmin(username, password);

            return ResponseEntity.ok(Map.of(
                    "mensaje", "Usuario ADMINISTRATIVO creado correctamente.",
                    "username", u.getUsername()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lista todos los usuarios del panel con su estado.
     * Solo accesible para ADMINISTRATIVO.
     */
    @GetMapping("/usuarios")
    @PreAuthorize("hasRole('ADMINISTRATIVO')")
    public ResponseEntity<?> listarUsuarios() {
        List<Map<String, Object>> usuarios = usuarioRepo.findAll().stream()
                .map(u -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("username", u.getUsername());
                    m.put("rol", u.getRol().name());
                    m.put("activo", u.isActivo());
                    if (u.getDocente() != null) {
                        m.put("docenteId", u.getDocente().getId());
                        m.put("docenteNombre",
                                u.getDocente().getNombre() + " " + u.getDocente().getApellido());
                    }
                    return m;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(usuarios);
    }

    /**
     * Sincroniza: crea usuarios_panel para todos los docentes activos que aún no tienen uno.
     * Solo accesible para ADMINISTRATIVO.
     *
     * Devuelve la lista de usuarios creados en esta operación.
     * Contraseña por defecto: docente{id}123  (el admin debe cambiarla).
     */
    @PostMapping("/sincronizar")
    @PreAuthorize("hasRole('ADMINISTRATIVO')")
    public ResponseEntity<?> sincronizarDocentes() {
        List<Map<String, Object>> creados = docenteRepo.findByActivoTrue().stream()
                .filter(d -> usuarioRepo.findByDocenteId(d.getId()).isEmpty())
                .map(d -> {
                    String username = "docente_" + d.getId();
                    String password = "docente" + d.getId() + "123";
                    try {
                        authService.crearUsuarioDocente(username, password, d.getId());
                        Map<String, Object> m = new java.util.LinkedHashMap<>();
                        m.put("docenteId", d.getId());
                        m.put("nombre", d.getNombre() + " " + d.getApellido());
                        m.put("username", username);
                        m.put("passwordInicial", password);
                        return m;
                    } catch (RuntimeException ex) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());

        if (creados.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "mensaje", "Todos los docentes activos ya tienen usuario. Nada que sincronizar.",
                    "creados", creados
            ));
        }

        return ResponseEntity.ok(Map.of(
                "mensaje", creados.size() + " usuario(s) creado(s).",
                "creados", creados
        ));
    }
}