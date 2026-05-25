package com.edubot.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "docentes")
@Data
public class Docente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;
    private String apellido;
    private String curso;
    private String email;
    private boolean activo = true;
}
