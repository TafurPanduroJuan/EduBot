package com.edubot.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Entity
@Table(name = "citas")
@Data
public class Cita {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String ticket;

    @ManyToOne
    @JoinColumn(name = "padre_id")
    private Padre padre;

    @ManyToOne
    @JoinColumn(name = "docente_id")
    private Docente docente;

    @ManyToOne
    @JoinColumn(name = "estudiante_id")
    private Estudiante estudiante;

    private LocalDate fecha;

    @Column(name = "hora_inicio")
    private LocalTime horaInicio;

    @Column(name = "hora_fin")
    private LocalTime horaFin;

    // 'rendimiento', 'conducta', 'salud', 'otro'
    private String motivo;

    // 'pendiente', 'confirmada', 'cancelada', 'completada'
    private String estado = "confirmada";

    private Boolean asistio;
    private Integer satisfaccion;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
