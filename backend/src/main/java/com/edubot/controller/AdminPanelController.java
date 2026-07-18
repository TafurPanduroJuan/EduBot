package com.edubot.controller;

import com.edubot.dto.DashboardResumenDTO;
import com.edubot.model.Docente;
import com.edubot.model.DisponibilidadDocente;
import com.edubot.model.Estudiante;
import com.edubot.model.Padre;
import com.edubot.model.UsuarioPanel;
import com.edubot.repository.DisponibilidadRepository;
import com.edubot.repository.DocenteRepository;
import com.edubot.repository.EstudianteRepository;
import com.edubot.repository.PadreRepository;
import com.edubot.repository.UsuarioPanelRepository;
import com.edubot.service.AuthService;
import com.edubot.service.DashboardService;
import com.edubot.service.ExportacionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AdminPanelController — endpoints exclusivos del panel ADMINISTRATIVO.
 *
 * Todas las rutas bajo /api/panel/admin/** ya están protegidas en SecurityConfig
 * con hasRole('ADMINISTRATIVO') — no se toca nada de seguridad existente.
 *
 * HU008 — Dashboard con métricas y alertas IA.
 * HU009 — Exportación de reportes (PDF/Excel/CSV) + gestión de disponibilidades.
 * NUEVO — Alta de docentes (+ credenciales), padres y estudiantes desde el
 *         panel, para no depender de tocar la base de datos directamente.
 */
@RestController
@RequestMapping("/api/panel/admin")
@PreAuthorize("hasRole('ADMINISTRATIVO')")
@Tag(name = "Panel Administrativo", description = "Dashboard, reportes y gestión de docentes/padres (HU008, HU009)")
public class AdminPanelController {

    private final DashboardService dashboardService;
    private final ExportacionService exportacionService;
    private final DisponibilidadRepository disponibilidadRepository;
    private final DocenteRepository docenteRepository;
    private final PadreRepository padreRepository;
    private final EstudianteRepository estudianteRepository;
    private final UsuarioPanelRepository usuarioPanelRepository;
    private final AuthService authService;

    public AdminPanelController(DashboardService dashboardService,
                                 ExportacionService exportacionService,
                                 DisponibilidadRepository disponibilidadRepository,
                                 DocenteRepository docenteRepository,
                                 PadreRepository padreRepository,
                                 EstudianteRepository estudianteRepository,
                                 UsuarioPanelRepository usuarioPanelRepository,
                                 AuthService authService) {
        this.dashboardService = dashboardService;
        this.exportacionService = exportacionService;
        this.disponibilidadRepository = disponibilidadRepository;
        this.docenteRepository = docenteRepository;
        this.padreRepository = padreRepository;
        this.estudianteRepository = estudianteRepository;
        this.usuarioPanelRepository = usuarioPanelRepository;
        this.authService = authService;
    }

    // ── HU008: Dashboard resumen ──────────────────────────────────────────────

    @Operation(summary = "Obtener métricas del dashboard",
               description = "Devuelve métricas del período y alertas generadas por IA")
    @GetMapping("/dashboard/resumen")
    public ResponseEntity<DashboardResumenDTO> obtenerResumen(
            @RequestParam(defaultValue = "mensual") String periodo) {

        DashboardResumenDTO resumen = dashboardService.generarResumen(periodo);
        return ResponseEntity.ok(resumen);
    }

    // ── HU009: Exportación de reportes ───────────────────────────────────────

    @Operation(summary = "Exportar reporte",
               description = "Genera y descarga el reporte en formato pdf, excel o csv")
    @GetMapping("/reportes/exportar")
    public ResponseEntity<byte[]> exportarReporte(
            @RequestParam(defaultValue = "pdf") String formato,
            @RequestParam(defaultValue = "mensual") String periodo) {

        try {
            ExportacionService.ResultadoExportacion resultado =
                    exportacionService.exportar(formato, periodo);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(resultado.getContentType()));
            headers.setContentDispositionFormData("attachment", resultado.getNombreArchivo());

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resultado.getBytes());

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ── HU009: Disponibilidades de todos los docentes (solo lectura) ──────────

    @Operation(summary = "Ver disponibilidades de todos los docentes",
               description = "Solo lectura para el administrador")
    @GetMapping("/disponibilidades")
    public ResponseEntity<List<DisponibilidadDocente>> obtenerTodasDisponibilidades() {
        List<DisponibilidadDocente> todas = disponibilidadRepository.findAll();
        return ResponseEntity.ok(todas);
    }

    // ── HU009: Disponibilidades de un docente específico ─────────────────────

    @Operation(summary = "Ver disponibilidades de un docente específico")
    @GetMapping("/disponibilidades/{docenteId}")
    public ResponseEntity<?> obtenerDisponibilidadesPorDocente(
            @PathVariable Long docenteId) {

        LocalDate hoy = LocalDate.now();
        List<DisponibilidadDocente> bloques =
                disponibilidadRepository
                        .findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(docenteId, hoy);

        return ResponseEntity.ok(Map.of(
                "docenteId", docenteId,
                "bloques", bloques
        ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GESTIÓN DE DOCENTES — alta de profesores + credenciales de acceso
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * GET /api/panel/admin/docentes
     * Lista todos los docentes e indica si ya tienen usuario de acceso al panel.
     */
    @Operation(summary = "Listar docentes", description = "Incluye si cada uno ya tiene credenciales de acceso")
    @GetMapping("/docentes")
    public ResponseEntity<?> listarDocentes() {
        List<Map<String, Object>> resultado = docenteRepository.findAll().stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("nombre", d.getNombre());
            m.put("apellido", d.getApellido());
            m.put("curso", d.getCurso());
            m.put("email", d.getEmail());
            m.put("activo", d.isActivo());
            boolean tieneCredenciales = !usuarioPanelRepository.findByDocenteId(d.getId()).isEmpty();
            m.put("tieneCredenciales", tieneCredenciales);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(resultado);
    }

    /**
     * POST /api/panel/admin/docentes
     * Da de alta a un nuevo docente. Antes de este endpoint la única forma
     * de agregar un profesor era insertando directamente en la tabla
     * "docentes" desde la base de datos.
     *
     * Body: {
     *   "nombre": "Ricardo", "apellido": "Flores",
     *   "curso": "Comunicación", "email": "ricardo.flores@colegio.edu.pe",
     *   "crearCredenciales": true,             // opcional, default false
     *   "username": "ricardo.flores",          // requerido si crearCredenciales=true
     *   "password": "colegio2026"              // requerido si crearCredenciales=true
     * }
     */
    @Operation(summary = "Registrar un nuevo docente",
               description = "Opcionalmente crea de una vez sus credenciales de acceso al panel")
    @PostMapping("/docentes")
    public ResponseEntity<?> crearDocente(@RequestBody Map<String, Object> body) {
        String nombre   = (String) body.get("nombre");
        String apellido = (String) body.get("apellido");
        if (nombre == null || nombre.isBlank() || apellido == null || apellido.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "nombre y apellido son requeridos"));
        }

        Docente docente = new Docente();
        docente.setNombre(nombre.trim());
        docente.setApellido(apellido.trim());
        docente.setCurso((String) body.getOrDefault("curso", null));
        docente.setEmail((String) body.getOrDefault("email", null));
        docente.setActivo(true);
        docente = docenteRepository.save(docente);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("mensaje", "Docente registrado correctamente.");
        resp.put("docenteId", docente.getId());

        boolean crearCredenciales = Boolean.TRUE.equals(body.get("crearCredenciales"));
        if (crearCredenciales) {
            String username = (String) body.get("username");
            String password = (String) body.get("password");
            if (username == null || username.isBlank() || password == null || password.isBlank()) {
                resp.put("advertencia",
                        "Docente creado, pero NO se generaron credenciales: username/password faltantes.");
                return ResponseEntity.ok(resp);
            }
            try {
                UsuarioPanel usuario = authService.crearUsuarioDocente(username.trim(), password, docente.getId());
                resp.put("credenciales", Map.of(
                        "username", usuario.getUsername(),
                        "rol", usuario.getRol().name()
                ));
            } catch (RuntimeException e) {
                resp.put("advertencia", "Docente creado, pero falló la creación de credenciales: " + e.getMessage());
            }
        }

        return ResponseEntity.ok(resp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GESTIÓN DE PADRES Y ESTUDIANTES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * GET /api/panel/admin/padres
     * Lista todos los padres registrados junto con sus hijos vinculados.
     */
    @Operation(summary = "Listar padres registrados", description = "Incluye a sus hijos (estudiantes) vinculados")
    @GetMapping("/padres")
    public ResponseEntity<?> listarPadres() {
        List<Map<String, Object>> resultado = padreRepository.findAll().stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("dni", p.getDni());
            m.put("nombre", p.getNombre());
            m.put("apellido", p.getApellido());
            m.put("telefono", p.getTelefono());
            m.put("horarioLaboral", p.getHorarioLaboral());
            List<Map<String, Object>> hijos = estudianteRepository.findByPadreId(p.getId()).stream()
                    .map(h -> {
                        Map<String, Object> hm = new LinkedHashMap<>();
                        hm.put("id", h.getId());
                        hm.put("nombre", h.getNombre());
                        hm.put("apellido", h.getApellido());
                        hm.put("grado", h.getGrado());
                        hm.put("seccion", h.getSeccion());
                        return hm;
                    }).collect(Collectors.toList());
            m.put("estudiantes", hijos);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(resultado);
    }

    /**
     * POST /api/panel/admin/padres
     * Registra un nuevo padre de familia (necesario para que pueda
     * identificarse por DNI en EduBot). Antes solo se podía insertar
     * directamente en la tabla "padres".
     *
     * Body: {
     *   "dni": "71234567", "nombre": "Rosa", "apellido": "Mamani",
     *   "telefono": "987654321", "horarioLaboral": "tarde"
     * }
     */
    @Operation(summary = "Registrar un nuevo padre de familia")
    @PostMapping("/padres")
    public ResponseEntity<?> crearPadre(@RequestBody Map<String, Object> body) {
        String dni = (String) body.get("dni");
        String nombre = (String) body.get("nombre");
        String apellido = (String) body.get("apellido");

        if (dni == null || !dni.matches("\\d{8}")) {
            return ResponseEntity.badRequest().body(Map.of("error", "El DNI debe tener 8 dígitos"));
        }
        if (nombre == null || nombre.isBlank() || apellido == null || apellido.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "nombre y apellido son requeridos"));
        }
        if (padreRepository.findByDni(dni).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ya existe un padre registrado con ese DNI"));
        }

        String horario = (String) body.get("horarioLaboral");
        if (horario != null && !horario.isBlank()
                && !List.of("manana", "tarde", "noche").contains(horario)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "horarioLaboral debe ser 'manana', 'tarde' o 'noche'"));
        }

        Padre padre = new Padre();
        padre.setDni(dni);
        padre.setNombre(nombre.trim());
        padre.setApellido(apellido.trim());
        padre.setTelefono((String) body.getOrDefault("telefono", null));
        padre.setHorarioLaboral(horario);
        padre = padreRepository.save(padre);

        return ResponseEntity.ok(Map.of(
                "mensaje", "Padre registrado correctamente.",
                "padreId", padre.getId()
        ));
    }

    /**
     * POST /api/panel/admin/padres/{padreId}/estudiantes
     * Vincula un hijo (estudiante) a un padre ya registrado.
     *
     * Body: { "nombre": "Luis", "apellido": "Mamani", "grado": "3ro", "seccion": "A" }
     */
    @Operation(summary = "Registrar un estudiante y vincularlo a un padre existente")
    @PostMapping("/padres/{padreId}/estudiantes")
    public ResponseEntity<?> crearEstudiante(
            @PathVariable Long padreId,
            @RequestBody Map<String, Object> body) {

        Padre padre = padreRepository.findById(padreId).orElse(null);
        if (padre == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No existe un padre con id " + padreId));
        }

        String nombre = (String) body.get("nombre");
        String apellido = (String) body.get("apellido");
        if (nombre == null || nombre.isBlank() || apellido == null || apellido.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "nombre y apellido son requeridos"));
        }

        Estudiante estudiante = new Estudiante();
        estudiante.setNombre(nombre.trim());
        estudiante.setApellido(apellido.trim());
        estudiante.setGrado((String) body.getOrDefault("grado", null));
        estudiante.setSeccion((String) body.getOrDefault("seccion", null));
        estudiante.setPadre(padre);
        estudiante = estudianteRepository.save(estudiante);

        return ResponseEntity.ok(Map.of(
                "mensaje", "Estudiante vinculado correctamente.",
                "estudianteId", estudiante.getId(),
                "padreId", padre.getId()
        ));
    }
}