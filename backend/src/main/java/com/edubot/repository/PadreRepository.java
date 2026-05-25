package com.edubot.repository;

import com.edubot.model.Padre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface PadreRepository extends JpaRepository<Padre, Long> {
    Optional<Padre> findByDni(String dni);
}
