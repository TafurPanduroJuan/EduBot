package com.edubot.config;

import com.edubot.repository.DocenteRepository;
import com.edubot.repository.UsuarioPanelRepository;
import com.edubot.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;


@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UsuarioPanelRepository usuarioRepo;
    private final DocenteRepository docenteRepo;
    private final AuthService authService;

    public DataSeeder(UsuarioPanelRepository usuarioRepo,
                      DocenteRepository docenteRepo,
                      AuthService authService) {
        this.usuarioRepo = usuarioRepo;
        this.docenteRepo = docenteRepo;
        this.authService = authService;
    }

    @Override
    public void run(String... args) {
        crearAdmin();
        // crearUsuariosDocentes() se eliminó a propósito — ver comentario de clase.
    }

    private void crearAdmin() {
        if (!usuarioRepo.existsByUsername("admin")) {
            authService.crearUsuarioAdmin("admin", "admin123");
            log.info("[Seed] Usuario ADMINISTRATIVO creado: admin / admin123");
        } else {
            log.info("[Seed] Admin ya existe — omitido");
        }
    }
}