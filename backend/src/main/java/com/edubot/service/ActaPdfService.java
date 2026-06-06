package com.edubot.service;

import com.edubot.model.Cita;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.property.TextAlignment;
import com.itextpdf.layout.property.UnitValue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;

@Service
public class ActaPdfService {

    private static final Logger log = LoggerFactory.getLogger(ActaPdfService.class);

    @Value("${edubot.actas.directorio:actas}")
    private String directorioActas;

    @Value("${edubot.actas.url-base:http://localhost:8080/actas}")
    private String urlBase;

    // Colores institucionales MINEDU (azul marino)
    private static final DeviceRgb COLOR_MINEDU    = new DeviceRgb(0, 58, 122);
    private static final DeviceRgb COLOR_SECCION   = new DeviceRgb(0, 94, 184);
    private static final DeviceRgb COLOR_GRIS_CLARO = new DeviceRgb(245, 245, 245);

    /**
     * Genera el PDF del acta y lo guarda en disco.
     *
     * @param cita           Datos de la cita
     * @param actaEstructurada Texto ya estructurado por la IA (ACUERDOS/COMPROMISOS/SEGUIMIENTO)
     * @return URL pública de descarga del PDF
     */
    public String generarPdf(Cita cita, String actaEstructurada) throws IOException {
        // Asegurar que el directorio existe
        Path dirPath = Paths.get(directorioActas);
        Files.createDirectories(dirPath);

        // Nombre del archivo: ACTA-{ticket}-{timestamp}.pdf
        String nombreArchivo = "ACTA-" + cita.getTicket() + ".pdf";
        Path rutaArchivo = dirPath.resolve(nombreArchivo);

        // Generar el PDF
        try (PdfWriter writer = new PdfWriter(rutaArchivo.toString());
             PdfDocument pdf = new PdfDocument(writer);
             Document doc = new Document(pdf, PageSize.A4)) {

            doc.setMargins(40, 50, 40, 50);

            agregarEncabezado(doc, cita);
            agregarLineaDivisora(doc);
            agregarDatosCita(doc, cita);
            agregarLineaDivisora(doc);
            agregarCuerpoActa(doc, actaEstructurada);
            agregarSeccionFirmas(doc, cita);
            agregarPiePagina(doc, cita);
        }

        String urlDescarga = urlBase.endsWith("/")
            ? urlBase + nombreArchivo
            : urlBase + "/" + nombreArchivo;

        log.info("[HU007] PDF generado: {} → {}", rutaArchivo, urlDescarga);
        return urlDescarga;
    }

    /**
     * Resuelve la ruta de un archivo de acta por nombre de archivo.
     * Usado por el endpoint de descarga directa.
     */
    public Path resolverRuta(String nombreArchivo) {
        return Paths.get(directorioActas).resolve(nombreArchivo).normalize();
    }

    // ── Secciones del PDF ─────────────────────────────────────────────────────

    private void agregarEncabezado(Document doc, Cita cita) throws IOException {
        // Tabla de 2 columnas: logo-texto | título
        Table tablaHeader = new Table(UnitValue.createPercentArray(new float[]{60, 40}))
            .setWidth(UnitValue.createPercentValue(100))
            .setBorder(Border.NO_BORDER);

        // Columna izquierda: nombre institución
        Cell celdaLeft = new Cell().setBorder(Border.NO_BORDER);
        celdaLeft.add(new Paragraph("MINISTERIO DE EDUCACIÓN")
            .setFontColor(COLOR_MINEDU)
            .setFontSize(9)
            .setBold());
        celdaLeft.add(new Paragraph("INSTITUCIÓN EDUCATIVA EduBot")
            .setFontColor(COLOR_MINEDU)
            .setFontSize(11)
            .setBold());
        celdaLeft.add(new Paragraph("Sistema de Gestión de Citas Escolares")
            .setFontColor(ColorConstants.GRAY)
            .setFontSize(8));

        // Columna derecha: título del documento
        Cell celdaRight = new Cell().setBorder(Border.NO_BORDER)
            .setTextAlignment(TextAlignment.RIGHT);
        celdaRight.add(new Paragraph("ACTA DE REUNIÓN")
            .setFontColor(COLOR_MINEDU)
            .setFontSize(14)
            .setBold());
        celdaRight.add(new Paragraph("Ticket: " + cita.getTicket())
            .setFontColor(COLOR_SECCION)
            .setFontSize(9));

        tablaHeader.addCell(celdaLeft);
        tablaHeader.addCell(celdaRight);
        doc.add(tablaHeader);
        doc.add(new Paragraph("\n").setFontSize(2));
    }

    private void agregarLineaDivisora(Document doc) {
        Table linea = new Table(1)
            .setWidth(UnitValue.createPercentValue(100))
            .setBackgroundColor(COLOR_MINEDU);
        linea.addCell(new Cell().setHeight(2).setBorder(Border.NO_BORDER));
        doc.add(linea);
        doc.add(new Paragraph("\n").setFontSize(4));
    }

    private void agregarDatosCita(Document doc, Cita cita) {
        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        DateTimeFormatter fmtHora  = DateTimeFormatter.ofPattern("HH:mm");

        doc.add(new Paragraph("DATOS DE LA REUNIÓN")
            .setFontColor(COLOR_MINEDU)
            .setFontSize(10)
            .setBold()
            .setMarginBottom(5));

        Table tabla = new Table(UnitValue.createPercentArray(new float[]{25, 75}))
            .setWidth(UnitValue.createPercentValue(100))
            .setBackgroundColor(COLOR_GRIS_CLARO)
            .setMarginBottom(10);

        agregarFilaDato(tabla, "Docente",
            "Prof. " + cita.getDocente().getNombre() + " " + cita.getDocente().getApellido());
        agregarFilaDato(tabla, "Curso", cita.getDocente().getCurso());
        agregarFilaDato(tabla, "Padre/Tutor",
            cita.getPadre().getNombre() + " " + cita.getPadre().getApellido());

        if (cita.getEstudiante() != null) {
            agregarFilaDato(tabla, "Estudiante",
                cita.getEstudiante().getNombre() + " " + cita.getEstudiante().getApellido());
            agregarFilaDato(tabla, "Grado/Sección",
                cita.getEstudiante().getGrado() + " " + cita.getEstudiante().getSeccion());
        }

        agregarFilaDato(tabla, "Fecha", cita.getFecha().format(fmtFecha));
        agregarFilaDato(tabla, "Hora",
            cita.getHoraInicio().format(fmtHora) + " — " + cita.getHoraFin().format(fmtHora));
        agregarFilaDato(tabla, "Motivo", capitalizarMotivo(cita.getMotivo()));

        doc.add(tabla);
    }

    private void agregarCuerpoActa(Document doc, String actaEstructurada) {
        doc.add(new Paragraph("CONTENIDO DEL ACTA")
            .setFontColor(COLOR_MINEDU)
            .setFontSize(10)
            .setBold()
            .setMarginBottom(8));

        // Parsear las secciones del texto estructurado por la IA
        String[] secciones = {"ACUERDOS:", "COMPROMISOS:", "SEGUIMIENTO:"};

        String textoRestante = actaEstructurada.trim();

        for (String seccion : secciones) {
            int idx = textoRestante.indexOf(seccion);
            if (idx < 0) continue;

            // Buscar fin de esta sección (inicio de la siguiente o fin de string)
            int siguiente = textoRestante.length();
            for (String otraSec : secciones) {
                if (!otraSec.equals(seccion)) {
                    int idxOtra = textoRestante.indexOf(otraSec, idx + seccion.length());
                    if (idxOtra > 0 && idxOtra < siguiente) {
                        siguiente = idxOtra;
                    }
                }
            }

            String contenido = textoRestante.substring(idx + seccion.length(), siguiente).trim();

            // Título de sección con fondo azul
            Table tituloSec = new Table(1)
                .setWidth(UnitValue.createPercentValue(100))
                .setBackgroundColor(COLOR_SECCION)
                .setMarginTop(8);
            tituloSec.addCell(
                new Cell()
                    .add(new Paragraph(seccion.replace(":", ""))
                        .setFontColor(ColorConstants.WHITE)
                        .setFontSize(10)
                        .setBold())
                    .setBorder(Border.NO_BORDER)
                    .setPadding(5)
            );
            doc.add(tituloSec);

            // Contenido de la sección
            doc.add(new Paragraph(contenido)
                .setFontSize(10)
                .setTextAlignment(TextAlignment.JUSTIFIED)
                .setMarginLeft(10)
                .setMarginTop(5)
                .setMarginBottom(5));
        }

        doc.add(new Paragraph("\n").setFontSize(4));
    }

    private void agregarSeccionFirmas(Document doc, Cita cita) {
        agregarLineaDivisora(doc);

        doc.add(new Paragraph("FIRMAS")
            .setFontColor(COLOR_MINEDU)
            .setFontSize(10)
            .setBold()
            .setMarginTop(10)
            .setMarginBottom(20));

        Table tablaFirmas = new Table(UnitValue.createPercentArray(new float[]{50, 50}))
            .setWidth(UnitValue.createPercentValue(100))
            .setBorder(Border.NO_BORDER);

        // Firma docente
        Cell firmaDocente = new Cell().setBorder(Border.NO_BORDER)
            .setTextAlignment(TextAlignment.CENTER);
        firmaDocente.add(new Paragraph("\n\n\n_________________________")
            .setFontSize(10));
        firmaDocente.add(new Paragraph(
            "Prof. " + cita.getDocente().getNombre() + " " + cita.getDocente().getApellido())
            .setFontSize(9).setBold());
        firmaDocente.add(new Paragraph("Docente").setFontSize(8)
            .setFontColor(ColorConstants.GRAY));

        // Firma padre
        Cell firmaPadre = new Cell().setBorder(Border.NO_BORDER)
            .setTextAlignment(TextAlignment.CENTER);
        firmaPadre.add(new Paragraph("\n\n\n_________________________")
            .setFontSize(10));
        firmaPadre.add(new Paragraph(
            cita.getPadre().getNombre() + " " + cita.getPadre().getApellido())
            .setFontSize(9).setBold());
        firmaPadre.add(new Paragraph("Padre / Apoderado").setFontSize(8)
            .setFontColor(ColorConstants.GRAY));

        tablaFirmas.addCell(firmaDocente);
        tablaFirmas.addCell(firmaPadre);
        doc.add(tablaFirmas);
    }

    private void agregarPiePagina(Document doc, Cita cita) {
        doc.add(new Paragraph("\n"));
        doc.add(new Paragraph(
            "Documento generado automáticamente por EduBot — Sistema de Gestión de Citas Escolares | " +
            "Ticket: " + cita.getTicket())
            .setFontSize(7)
            .setFontColor(ColorConstants.GRAY)
            .setTextAlignment(TextAlignment.CENTER));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void agregarFilaDato(Table tabla, String etiqueta, String valor) {
        tabla.addCell(new Cell()
            .add(new Paragraph(etiqueta).setFontSize(9).setBold())
            .setBorder(Border.NO_BORDER)
            .setPaddingLeft(8)
            .setPaddingTop(3)
            .setPaddingBottom(3));
        tabla.addCell(new Cell()
            .add(new Paragraph(valor != null ? valor : "-").setFontSize(9))
            .setBorder(Border.NO_BORDER)
            .setPaddingTop(3)
            .setPaddingBottom(3));
    }

    private String capitalizarMotivo(String motivo) {
        if (motivo == null) return "No especificado";
        return switch (motivo.toLowerCase()) {
            case "rendimiento" -> "Rendimiento Académico";
            case "conducta"    -> "Conducta / Comportamiento";
            case "salud"       -> "Salud del Estudiante";
            case "otro"        -> "Otro";
            default            -> motivo.substring(0, 1).toUpperCase() + motivo.substring(1);
        };
    }
}
