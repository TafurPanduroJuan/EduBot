package com.edubot.service;

import com.edubot.integration.AIService;
import com.edubot.model.Cita;
import com.edubot.repository.CitaRepository;
import lombok.Data;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * ExportacionService — genera reportes descargables en PDF, Excel y CSV (HU009).
 */
@Service
public class ExportacionService {

    private final CitaRepository citaRepository;
    private final AIService aiService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public ExportacionService(CitaRepository citaRepository,
                               AIService aiService) {
        this.citaRepository = citaRepository;
        this.aiService = aiService;
    }

    /**
     * Exporta el reporte en el formato solicitado.
     *
     * @param formato  "pdf" | "excel" | "csv"
     * @param periodo  "semanal" | "mensual" | "anual"
     */
    public ResultadoExportacion exportar(String formato, String periodo) {
        List<Cita> citas = obtenerCitasPeriodo(periodo);
        String resumenEjecutivo = generarResumenEjecutivoIA(citas, periodo);

        return switch (formato.toLowerCase()) {
            case "pdf"   -> exportarPDF(citas, periodo, resumenEjecutivo);
            case "excel" -> exportarExcel(citas, periodo, resumenEjecutivo);
            case "csv"   -> exportarCSV(citas, periodo, resumenEjecutivo);
            default      -> throw new IllegalArgumentException(
                    "Formato no soportado: " + formato + ". Use: pdf, excel, csv");
        };
    }

    // ── PDF ────────────────────────────────────────────────────────────────────

    private ResultadoExportacion exportarPDF(List<Cita> citas, String periodo, String resumenIA) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            com.itextpdf.kernel.pdf.PdfWriter writer = new com.itextpdf.kernel.pdf.PdfWriter(baos);
            com.itextpdf.kernel.pdf.PdfDocument pdf = new com.itextpdf.kernel.pdf.PdfDocument(writer);
            com.itextpdf.layout.Document doc = new com.itextpdf.layout.Document(pdf);

            doc.add(new com.itextpdf.layout.element.Paragraph(
                    "Reporte EduBot — Período: " + periodo.toUpperCase())
                    .setFontSize(16).setBold());

            doc.add(new com.itextpdf.layout.element.Paragraph(
                    "Generado el: " + LocalDate.now().format(FMT)).setFontSize(10));

            doc.add(new com.itextpdf.layout.element.Paragraph(" "));

            doc.add(new com.itextpdf.layout.element.Paragraph("Resumen Ejecutivo (IA)")
                    .setFontSize(13).setBold());
            doc.add(new com.itextpdf.layout.element.Paragraph(resumenIA).setFontSize(11));

            doc.add(new com.itextpdf.layout.element.Paragraph(" "));

            doc.add(new com.itextpdf.layout.element.Paragraph("Detalle de Citas")
                    .setFontSize(13).setBold());

            com.itextpdf.layout.element.Table tabla =
                    new com.itextpdf.layout.element.Table(new float[]{80, 120, 120, 100, 80, 60});
            tabla.setWidth(com.itextpdf.layout.properties.UnitValue.createPercentValue(100));

            for (String header : new String[]{"Ticket", "Padre", "Docente", "Estudiante", "Fecha", "Estado"}) {
                tabla.addHeaderCell(new com.itextpdf.layout.element.Cell()
                        .add(new com.itextpdf.layout.element.Paragraph(header).setBold())
                        .setFontSize(9));
            }

            for (Cita c : citas) {
                tabla.addCell(celda(c.getTicket()));
                tabla.addCell(celda(c.getPadre() != null ? c.getPadre().getNombre() : "-"));
                tabla.addCell(celda(c.getDocente() != null
                        ? c.getDocente().getNombre() + " " + c.getDocente().getApellido() : "-"));
                tabla.addCell(celda(c.getEstudiante() != null ? c.getEstudiante().getNombre() : "-"));
                tabla.addCell(celda(c.getFecha() != null ? c.getFecha().format(FMT) : "-"));
                tabla.addCell(celda(c.getEstado()));
            }

            doc.add(tabla);
            doc.close();

            String nombre = "reporte_edubot_" + periodo + "_" + LocalDate.now() + ".pdf";
            return new ResultadoExportacion(baos.toByteArray(), "application/pdf", nombre);

        } catch (IOException e) {
            throw new RuntimeException("Error generando PDF: " + e.getMessage(), e);
        }
    }

    // ── Excel ──────────────────────────────────────────────────────────────────

    private ResultadoExportacion exportarExcel(List<Cita> citas, String periodo, String resumenIA) {
        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Sheet resumen = wb.createSheet("Resumen Ejecutivo");
            CellStyle titleStyle = wb.createCellStyle();
            Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleStyle.setFont(titleFont);

            Row r0 = resumen.createRow(0);
            r0.createCell(0).setCellValue("Reporte EduBot — Período: " + periodo.toUpperCase());
            r0.getCell(0).setCellStyle(titleStyle);
            resumen.createRow(1).createCell(0)
                    .setCellValue("Generado el: " + LocalDate.now().format(FMT));
            Row r3 = resumen.createRow(3);
            r3.createCell(0).setCellValue("Resumen Ejecutivo (IA):");
            r3.getCell(0).setCellStyle(titleStyle);
            resumen.createRow(4).createCell(0).setCellValue(resumenIA);
            resumen.setColumnWidth(0, 15000);

            Sheet detalle = wb.createSheet("Citas");
            String[] headers = {"Ticket", "Padre", "Docente", "Estudiante", "Fecha", "Estado", "Asistió", "Motivo"};

            Row headerRow = detalle.createRow(0);
            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                detalle.setColumnWidth(i, 4000);
            }

            int rowIdx = 1;
            for (Cita c : citas) {
                Row row = detalle.createRow(rowIdx++);
                row.createCell(0).setCellValue(safe(c.getTicket()));
                row.createCell(1).setCellValue(c.getPadre() != null ? safe(c.getPadre().getNombre()) : "-");
                row.createCell(2).setCellValue(c.getDocente() != null
                        ? safe(c.getDocente().getNombre() + " " + c.getDocente().getApellido()) : "-");
                row.createCell(3).setCellValue(c.getEstudiante() != null ? safe(c.getEstudiante().getNombre()) : "-");
                row.createCell(4).setCellValue(c.getFecha() != null ? c.getFecha().format(FMT) : "-");
                row.createCell(5).setCellValue(safe(c.getEstado()));
                row.createCell(6).setCellValue(Boolean.TRUE.equals(c.getAsistio()) ? "Sí" : "No");
                row.createCell(7).setCellValue(safe(c.getMotivo()));
            }

            wb.write(baos);
            String nombre = "reporte_edubot_" + periodo + "_" + LocalDate.now() + ".xlsx";
            return new ResultadoExportacion(baos.toByteArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nombre);

        } catch (IOException e) {
            throw new RuntimeException("Error generando Excel: " + e.getMessage(), e);
        }
    }

    // ── CSV ────────────────────────────────────────────────────────────────────

    private ResultadoExportacion exportarCSV(List<Cita> citas, String periodo, String resumenIA) {
        StringBuilder sb = new StringBuilder();

        sb.append("# Reporte EduBot — Período: ").append(periodo.toUpperCase()).append("\n");
        sb.append("# Generado el: ").append(LocalDate.now().format(FMT)).append("\n");
        sb.append("# Resumen IA: ").append(resumenIA.replace("\n", " | ")).append("\n\n");
        sb.append("Ticket,Padre,Docente,Estudiante,Fecha,Estado,Asistio,Motivo\n");

        for (Cita c : citas) {
            sb.append(csv(c.getTicket())).append(",");
            sb.append(csv(c.getPadre() != null ? c.getPadre().getNombre() : "")).append(",");
            sb.append(csv(c.getDocente() != null
                    ? c.getDocente().getNombre() + " " + c.getDocente().getApellido() : "")).append(",");
            sb.append(csv(c.getEstudiante() != null ? c.getEstudiante().getNombre() : "")).append(",");
            sb.append(csv(c.getFecha() != null ? c.getFecha().format(FMT) : "")).append(",");
            sb.append(csv(c.getEstado())).append(",");
            sb.append(Boolean.TRUE.equals(c.getAsistio()) ? "Si" : "No").append(",");
            sb.append(csv(c.getMotivo())).append("\n");
        }

        byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        String nombre = "reporte_edubot_" + periodo + "_" + LocalDate.now() + ".csv";
        return new ResultadoExportacion(bytes, "text/csv; charset=UTF-8", nombre);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private List<Cita> obtenerCitasPeriodo(String periodo) {
        LocalDate hoy = LocalDate.now();
        LocalDate inicio = switch (periodo.toLowerCase()) {
            case "semanal" -> hoy.minusDays(7);
            case "anual"   -> hoy.minusYears(1);
            default        -> hoy.minusMonths(1);
        };
        return citaRepository.findAll().stream()
                .filter(c -> !c.getFecha().isBefore(inicio) && !c.getFecha().isAfter(hoy))
                .collect(Collectors.toList());
    }

    private String generarResumenEjecutivoIA(List<Cita> citas, String periodo) {
        try {
            return aiService.generarResumenEjecutivo(citas, periodo);
        } catch (Exception e) {
            return "No se pudo generar el resumen ejecutivo automático. "
                    + "Total de citas en el período: " + citas.size() + ".";
        }
    }

    private com.itextpdf.layout.element.Cell celda(String texto) {
        return new com.itextpdf.layout.element.Cell()
                .add(new com.itextpdf.layout.element.Paragraph(safe(texto)).setFontSize(8));
    }

    private String safe(String s) {
        return s != null ? s : "-";
    }

    private String csv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    // ── Result wrapper ─────────────────────────────────────────────────────────

    @Data
    public static class ResultadoExportacion {
        private final byte[] bytes;
        private final String contentType;
        private final String nombreArchivo;
    }
}