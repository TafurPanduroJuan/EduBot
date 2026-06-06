package com.edubot.repository;

import com.edubot.model.UsuarioPanel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioPanelRepository extends JpaRepository<UsuarioPanel, Long> {

    Optional<UsuarioPanel> findByUsername(String username);

    boolean existsByUsername(String username);

    Optional<UsuarioPanel> findByDocenteId(Long docenteId);
}
