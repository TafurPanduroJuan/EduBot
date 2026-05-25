package com.edubot.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.List;

@Entity
@Table(name = "padres")
@Data
public class Padre {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 8)
    private String dni;

    private String nombre;
    private String apellido;
    private String telefono;

    // Para la IA simulada: "manana", "tarde", "noche"
    @Column(name = "horario_laboral")
    private String horarioLaboral;

    @OneToMany(mappedBy = "padre", fetch = FetchType.LAZY)
    private List<Estudiante> estudiantes;
}
