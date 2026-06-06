package com.edubot.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * UsuarioPanel — representa a los usuarios que pueden iniciar sesión
 * en el panel web de EduBot (docentes y personal administrativo).
 *
 * Un UsuarioPanel puede estar vinculado a un Docente existente
 * (cuando su rol es DOCENTE) o no tener vínculo (cuando es ADMINISTRATIVO).
 */
@Entity
@Table(name = "usuarios_panel")
@Data
public class UsuarioPanel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password; // BCrypt hash

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol rol;

    /** Si el rol es DOCENTE, aquí va la referencia al docente vinculado */
    @OneToOne
    @JoinColumn(name = "docente_id")
    private Docente docente;

    private boolean activo = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Rol {
        DOCENTE,
        ADMINISTRATIVO
    }
}
