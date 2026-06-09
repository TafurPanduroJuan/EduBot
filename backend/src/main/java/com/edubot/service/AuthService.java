package com.edubot.service;

import com.edubot.dto.LoginRequest;
import com.edubot.dto.LoginResponse;
import com.edubot.model.Docente;
import com.edubot.model.UsuarioPanel;
import com.edubot.repository.DocenteRepository;
import com.edubot.repository.UsuarioPanelRepository;
import com.edubot.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AuthService — maneja login y creación de usuarios del panel.
 */
@Service
public class AuthService {

    private final UsuarioPanelRepository usuarioRepo;
    private final DocenteRepository docenteRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UsuarioPanelRepository usuarioRepo,
                       DocenteRepository docenteRepo,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil) {
        this.usuarioRepo     = usuarioRepo;
        this.docenteRepo     = docenteRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil         = jwtUtil;
    }

    /**
     * Autentica al usuario y devuelve un JWT con su rol y docenteId.
     */
    public LoginResponse login(LoginRequest req) {
        UsuarioPanel usuario = usuarioRepo.findByUsername(req.getUsername())
                .orElseThrow(() -> new RuntimeException("Usuario o contraseña incorrectos"));

        if (!usuario.isActivo()) {
            throw new RuntimeException("Usuario desactivado — contacta al administrador");
        }

        if (!passwordEncoder.matches(req.getPassword(), usuario.getPassword())) {
            throw new RuntimeException("Usuario o contraseña incorrectos");
        }

        Long docenteId    = null;
        String nombreDoc  = null;

        if (usuario.getRol() == UsuarioPanel.Rol.DOCENTE && usuario.getDocente() != null) {
            docenteId  = usuario.getDocente().getId();
            nombreDoc  = usuario.getDocente().getNombre() + " " + usuario.getDocente().getApellido();
        }

        String token = jwtUtil.generarToken(
                usuario.getUsername(),
                usuario.getRol().name(),
                docenteId
        );

        return new LoginResponse(token, usuario.getUsername(),
                usuario.getRol().name(), docenteId, nombreDoc);
    }

    /**
     * Crea un usuario DOCENTE vinculado a un Docente existente.
     * Útil para el seed inicial o para que el admin cree accesos.
     */
    @Transactional
    public UsuarioPanel crearUsuarioDocente(String username, String password, Long docenteId) {
        if (usuarioRepo.existsByUsername(username)) {
            throw new RuntimeException("El username '" + username + "' ya existe");
        }

        Docente docente = docenteRepo.findById(docenteId)
                .orElseThrow(() -> new RuntimeException("Docente no encontrado: " + docenteId));

        UsuarioPanel u = new UsuarioPanel();
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode(password));
        u.setRol(UsuarioPanel.Rol.DOCENTE);
        u.setDocente(docente);
        return usuarioRepo.save(u);
    }

    /**
     * Crea un usuario ADMINISTRATIVO.
     */
    @Transactional
    public UsuarioPanel crearUsuarioAdmin(String username, String password) {
        if (usuarioRepo.existsByUsername(username)) {
            throw new RuntimeException("El username '" + username + "' ya existe");
        }

        UsuarioPanel u = new UsuarioPanel();
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode(password));
        u.setRol(UsuarioPanel.Rol.ADMINISTRATIVO);
        return usuarioRepo.save(u);
    }
}
