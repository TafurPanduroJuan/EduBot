package com.edubot.integration;

import com.edubot.dto.HorarioSugeridoDTO;
import com.edubot.model.Padre;

import java.util.List;

/**
 * AIService — Contrato de la capa de Integración IA de EduBot
 *
 * Define la interfaz desacoplada entre el controlador y cualquier
 * implementación de inteligencia artificial (simulada, Anthropic, etc.).
 *
 * El controlador (ChatBotController) solo conoce esta interfaz.
 * Nunca depende de una implementación concreta → baja dependencia entre capas.
 *
 * Arquitectura M-V-C-BD:
 *   Controller → AIService (integration) → implementación concreta
 *
 * @author Jhesua Yola
 */
public interface AIService {

    /**
     * Sugiere los mejores horarios para que un padre agende una cita
     * con un docente, tomando en cuenta el motivo de la reunión.
     */
    List<HorarioSugeridoDTO> sugerirHorarios(Padre padre, Long docenteId, String motivo);

    /**
     * Genera un mensaje de bienvenida personalizado usando IA generativa.
     */
    String generarMensajeBienvenida(String nombrePadre, String motivo);
}