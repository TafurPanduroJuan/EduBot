package com.edubot.integration;

import com.edubot.dto.HorarioSugeridoDTO;
import com.edubot.model.Cita;
import com.edubot.model.Padre;

import java.util.List;

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

    /**
     * Genera un mensaje de recordatorio personalizado para el padre,
     * considerando su historial de citas anteriores con el mismo docente.
     *
     * @param cita          La cita próxima a realizarse
     * @param horasRestantes Horas que faltan (24 o 1)
     * @param citasAnteriores Número de citas previas del padre con ese docente
     * @return Texto del recordatorio personalizado
     */
    String generarMensajeRecordatorio(Cita cita, int horasRestantes, long citasAnteriores);

    /**
     * Genera un briefing estructurado para el docente antes de la cita.
     * Analiza el historial del estudiante y sugiere puntos clave a revisar.
     *
     * @param cita La cita próxima
     * @param citasAnteriores Lista de citas anteriores del padre
     * @return Texto estructurado con motivo, historial y puntos sugeridos
     */
    String generarBriefingDocente(Cita cita, List<Cita> citasAnteriores);

    /**
     * Convierte notas informales del docente en texto institucional
     * formato MINEDU con secciones: Acuerdos / Compromisos / Seguimiento.
     *
     * @param notasLibres Texto libre dictado por el docente
     * @param cita        La cita a la que corresponde el acta
     * @return Texto estructurado en formato institucional MINEDU
     */
    String estructurarActaMinedu(String notasLibres, Cita cita);

    /**
     * Analiza las citas del período y devuelve 2-3 alertas/insights
     * en lenguaje natural para mostrar en el panel admin (HU008).
     */
    List<String> generarAlertasDashboard(List<Cita> citas, double tasaAsistencia, String periodo);

    /**
     * Genera un párrafo de resumen ejecutivo a partir de las citas del período,
     * para adjuntar al reporte exportado (HU009).
     */
    String generarResumenEjecutivo(List<Cita> citas, String periodo);
}