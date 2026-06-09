package com.edubot.repository;

import com.edubot.model.Cita;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface CitaRepository extends JpaRepository<Cita, Long> {

    List<Cita> findByPadreIdAndDocenteIdOrderByFechaDesc(Long padreId, Long docenteId);

    List<Cita> findByPadreIdOrderByFechaDesc(Long padreId);

    List<Cita> findByFechaAndEstado(LocalDate fecha, String estado);

    /** Citas de un docente ordenadas por fecha y hora (para panel docente) */
    List<Cita> findByDocenteIdOrderByFechaAscHoraInicioAsc(Long docenteId);

    /** Citas de un docente en un rango de fechas (para dashboard) */
    List<Cita> findByDocenteIdAndFechaBetween(Long docenteId, LocalDate inicio, LocalDate fin);

    @Query("SELECT c FROM Cita c WHERE c.padre.id = :padreId AND c.estado = 'completada' AND c.asistio = true ORDER BY c.fecha DESC")
    List<Cita> findCitasExitosasByPadre(Long padreId);
}