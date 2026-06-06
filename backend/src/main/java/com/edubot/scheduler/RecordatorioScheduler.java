package com.edubot.scheduler;

import com.edubot.integration.AIService;
import com.edubot.model.Cita;
import com.edubot.repository.CitaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * HU005 — Scheduler de recordatorios automáticos.
 *
 * Corre cada hora, detecta citas a 24h y a 1h de distancia,
 * y llama a la IA para generar un mensaje personalizado de recordatorio
 * según el historial del padre con ese docente.
 *
 * En producción, el mensaje se enviaría por SMS/WhatsApp/email.
 * Por ahora se registra en logs (integración de mensajería fuera del scope).
 */
@Component
public class RecordatorioScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecordatorioScheduler.class);

    private final CitaRepository citaRepository;
    private final AIService aiService;

    public RecordatorioScheduler(CitaRepository citaRepository, AIService aiService) {
        this.citaRepository = citaRepository;
        this.aiService = aiService;
    }

    /**
     * Se ejecuta cada hora en punto.
     * Busca citas cuya hora de inicio sea en exactamente 24h o en 1h (±5 min de margen).
     */
    @Scheduled(cron = "0 0 * * * *")  // cada hora en punto
    public void enviarRecordatorios() {
        log.info("[HU005] Scheduler de recordatorios ejecutándose — {}", LocalDateTime.now());

        LocalDate hoy      = LocalDate.now();
        LocalTime ahoraH   = LocalTime.now().withMinute(0).withSecond(0).withNano(0);

        // Detectar citas a 24 horas
        procesarRecordatorios(hoy.plusDays(1), ahoraH, 24);

        // Detectar citas a 1 hora
        procesarRecordatorios(hoy, ahoraH.plusHours(1), 1);
    }

    private void procesarRecordatorios(LocalDate fecha, LocalTime horaObjetivo, int horasRestantes) {
        // Busca citas confirmadas en la fecha y hora objetivo (margen ±5 min)
        List<Cita> citas = citaRepository.findByFechaAndEstado(fecha, "confirmada");

        for (Cita cita : citas) {
            LocalTime horaInicio = cita.getHoraInicio();
            long diffMinutos = Math.abs(
                horaInicio.toSecondOfDay() / 60 - horaObjetivo.toSecondOfDay() / 60
            );

            if (diffMinutos <= 5) {
                enviarRecordatorio(cita, horasRestantes);
            }
        }
    }

    private void enviarRecordatorio(Cita cita, int horasRestantes) {
        try {
            // Contar citas anteriores del padre con este mismo docente
            long citasAnteriores = citaRepository
                .findByPadreIdAndDocenteIdOrderByFechaDesc(
                    cita.getPadre().getId(),
                    cita.getDocente().getId()
                )
                .stream()
                .filter(c -> !c.getId().equals(cita.getId()))
                .count();

            // Generar mensaje personalizado con IA
            String mensaje = aiService.generarMensajeRecordatorio(cita, horasRestantes, citasAnteriores);

            // ─── PUNTO DE INTEGRACIÓN ───────────────────────────────────────
            // Aquí se llamaría al servicio de WhatsApp/SMS/Email.
            // Por ahora se loguea el mensaje generado.
            // ────────────────────────────────────────────────────────────────

            log.info("[HU005] RECORDATORIO {}h → Padre: {} {} | Tel: {} | Cita: {} | Msg: \"{}\"",
                horasRestantes,
                cita.getPadre().getNombre(),
                cita.getPadre().getApellido(),
                cita.getPadre().getTelefono(),
                cita.getTicket(),
                mensaje
            );

        } catch (Exception e) {
            log.error("[HU005] Error procesando recordatorio para cita {}: {}",
                cita.getTicket(), e.getMessage());
        }
    }
}
