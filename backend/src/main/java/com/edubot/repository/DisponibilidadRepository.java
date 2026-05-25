package com.edubot.repository;

import com.edubot.model.DisponibilidadDocente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface DisponibilidadRepository extends JpaRepository<DisponibilidadDocente, Long> {
    List<DisponibilidadDocente> findByDocenteIdAndFechaGreaterThanEqualAndDisponibleTrue(
            Long docenteId, LocalDate desde);
}
