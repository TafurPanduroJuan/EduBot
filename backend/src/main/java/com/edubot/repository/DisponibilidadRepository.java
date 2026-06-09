package com.edubot.repository;

import com.edubot.model.DisponibilidadDocente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DisponibilidadRepository extends JpaRepository<DisponibilidadDocente, Long> {

    /** Usado por la IA de sugerencia de horarios (HU003) */
    List<DisponibilidadDocente> findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(
            Long docenteId, LocalDate desde);

    /** Todos los bloques del docente en un rango de fechas (HU004 — panel docente) */
    List<DisponibilidadDocente> findByDocenteIdAndFechaBetweenOrderByFechaAscHoraInicioAsc(
            Long docenteId, LocalDate desde, LocalDate hasta);

    /** Para la sugerencia IA: citas completadas del docente en los últimos 30 días */
    @Query("""
        SELECT d FROM DisponibilidadDocente d
        WHERE d.docente.id = :docenteId
          AND d.fecha >= :desde
        ORDER BY d.fecha ASC, d.horaInicio ASC
    """)
    List<DisponibilidadDocente> findByDocenteIdAndFechaGreaterThanEqual(
            Long docenteId, LocalDate desde);

    /** Elimina todos los bloques futuros de un docente (para reconfiguración total) */
    void deleteByDocenteIdAndFechaGreaterThanEqual(Long docenteId, LocalDate desde);
}
