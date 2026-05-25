package com.edubot.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "estudiantes")
@Data
public class Estudiante {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;
    private String apellido;
    private String grado;
    private String seccion;

    @ManyToOne
    @JoinColumn(name = "padre_id")
    private Padre padre;
}
