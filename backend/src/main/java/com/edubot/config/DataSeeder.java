package com.edubot.config;

import com.edubot.model.Docente;
import com.edubot.model.UsuarioPanel;
import com.edubot.repository.DocenteRepository;
import com.edubot.repository.UsuarioPanelRepository;
import com.edubot.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * DataSeeder — crea los usuarios iniciales del panel al arrancar la app.
 *
 * Solo crea datos si aún no existen, por lo que es seguro correrlo
 * en producción sin miedo a duplicar registros.
 *
 * Usuarios creados:
 *   - admin / admin123 (ADMINISTRATIVO)
 *   - Un usuario DOCENTE por cada docente existente en la base de datos
 *     con username = "docente_{id}" y password = "docente{id}123"
 *
 * 
 */
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
        crearUsuariosDocentes();
    }

    private void crearAdmin() {
        if (!usuarioRepo.existsByUsername("admin")) {
            authService.crearUsuarioAdmin("admin", "admin123");
            log.info("[Seed] Usuario ADMINISTRATIVO creado: admin / admin123");
        } else {
            log.info("[Seed] Admin ya existe — omitido");
        }
    }

    private void crearUsuariosDocentes() {
        List<Docente> docentes = docenteRepo.findByActivoTrue();
        for (Docente d : docentes) {
            String username = "docente_" + d.getId();
            if (!usuarioRepo.existsByUsername(username)) {
                String password = "docente" + d.getId() + "123";
                authService.crearUsuarioDocente(username, password, d.getId());
                log.info("[Seed] Usuario DOCENTE creado: {} / {} → {}",
                        username, password,
                        d.getNombre() + " " + d.getApellido());
            }
        }
    }
}
