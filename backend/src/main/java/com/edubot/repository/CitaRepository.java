package com.edubot.repository;

import com.edubot.model.Cita;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CitaRepository extends JpaRepository<Cita, Long> {

    List<Cita> findByPadreIdAndDocenteIdOrderByFechaDesc(Long padreId, Long docenteId);

    List<Cita> findByPadreIdOrderByFechaDesc(Long padreId);

    @Query("SELECT c FROM Cita c WHERE c.padre.id = :padreId AND c.estado = 'completada' AND c.asistio = true ORDER BY c.fecha DESC")
    List<Cita> findCitasExitosasByPadre(Long padreId);
}
