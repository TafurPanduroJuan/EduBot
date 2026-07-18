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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

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
                tabla.addCell(celda(c.getPadre() != null
                        ? c.getPadre().getNombre() + " " + c.getPadre().getApellido() : "-"));
                tabla.addCell(celda(c.getDocente() != null
                        ? c.getDocente().getNombre() + " " + c.getDocente().getApellido() : "-"));
                tabla.addCell(celda(c.getEstudiante() != null
                        ? c.getEstudiante().getNombre() + " " + c.getEstudiante().getApellido() : "-"));
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

            // ── Estilos reutilizables ────────────────────────────────────────
            Font fontTitulo = wb.createFont();
            fontTitulo.setBold(true);
            fontTitulo.setFontHeightInPoints((short) 16);
            fontTitulo.setColor(IndexedColors.WHITE.getIndex());

            CellStyle estiloTitulo = wb.createCellStyle();
            estiloTitulo.setFont(fontTitulo);
            estiloTitulo.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            estiloTitulo.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            estiloTitulo.setVerticalAlignment(VerticalAlignment.CENTER);
            estiloTitulo.setAlignment(HorizontalAlignment.LEFT);

            Font fontSubtitulo = wb.createFont();
            fontSubtitulo.setItalic(true);
            fontSubtitulo.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            CellStyle estiloSubtitulo = wb.createCellStyle();
            estiloSubtitulo.setFont(fontSubtitulo);

            Font fontSeccion = wb.createFont();
            fontSeccion.setBold(true);
            fontSeccion.setFontHeightInPoints((short) 12);
            fontSeccion.setColor(IndexedColors.DARK_BLUE.getIndex());
            CellStyle estiloSeccion = wb.createCellStyle();
            estiloSeccion.setFont(fontSeccion);

            CellStyle estiloResumenTexto = wb.createCellStyle();
            estiloResumenTexto.setWrapText(true);
            estiloResumenTexto.setVerticalAlignment(VerticalAlignment.TOP);

            Font fontHeader = wb.createFont();
            fontHeader.setBold(true);
            fontHeader.setColor(IndexedColors.WHITE.getIndex());
            CellStyle estiloHeader = wb.createCellStyle();
            estiloHeader.setFont(fontHeader);
            estiloHeader.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            estiloHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            estiloHeader.setAlignment(HorizontalAlignment.CENTER);
            estiloHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            estiloHeader.setBorderBottom(BorderStyle.THIN);

            CellStyle estiloCeldaBase = wb.createCellStyle();
            estiloCeldaBase.setBorderBottom(BorderStyle.THIN);
            estiloCeldaBase.setBorderTop(BorderStyle.THIN);
            estiloCeldaBase.setBorderLeft(BorderStyle.THIN);
            estiloCeldaBase.setBorderRight(BorderStyle.THIN);
            estiloCeldaBase.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
            estiloCeldaBase.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
            estiloCeldaBase.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
            estiloCeldaBase.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
            estiloCeldaBase.setVerticalAlignment(VerticalAlignment.CENTER);

            org.apache.poi.xssf.usermodel.XSSFCellStyle estiloCeldaAlterna =
                    (org.apache.poi.xssf.usermodel.XSSFCellStyle) wb.createCellStyle();
            estiloCeldaAlterna.cloneStyleFrom(estiloCeldaBase);
            estiloCeldaAlterna.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            estiloCeldaAlterna.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle estiloEstadoCompletada = crearEstiloEstado(wb, estiloCeldaBase, IndexedColors.GREEN);
            CellStyle estiloEstadoConfirmada = crearEstiloEstado(wb, estiloCeldaBase, IndexedColors.BLUE);
            CellStyle estiloEstadoCancelada  = crearEstiloEstado(wb, estiloCeldaBase, IndexedColors.RED);
            CellStyle estiloEstadoOtro       = crearEstiloEstado(wb, estiloCeldaBase, IndexedColors.GREY_50_PERCENT);

            Sheet resumen = wb.createSheet("Resumen Ejecutivo");
            resumen.setColumnWidth(0, 22000);

            Row r0 = resumen.createRow(0);
            r0.setHeightInPoints(26);
            Cell c0 = r0.createCell(0);
            c0.setCellValue("📘 Reporte EduBot — Período: " + periodo.toUpperCase());
            c0.setCellStyle(estiloTitulo);

            Row r1 = resumen.createRow(1);
            Cell c1 = r1.createCell(0);
            c1.setCellValue("Generado el: " + LocalDate.now().format(FMT) + "   |   Total de citas: " + citas.size());
            c1.setCellStyle(estiloSubtitulo);

            Row r3 = resumen.createRow(3);
            Cell c3 = r3.createCell(0);
            c3.setCellValue("Resumen Ejecutivo (IA)");
            c3.setCellStyle(estiloSeccion);

            Row r4 = resumen.createRow(4);
            r4.setHeightInPoints(70);
            Cell c4 = r4.createCell(0);
            c4.setCellValue(resumenIA);
            c4.setCellStyle(estiloResumenTexto);

            // ── Hoja "Citas" ──────────────────────────────────────────────────
            Sheet detalle = wb.createSheet("Citas");
            String[] headers = {"Ticket", "Padre", "Docente", "Estudiante", "Fecha", "Estado", "Asistió", "Motivo"};

            Row headerRow = detalle.createRow(0);
            headerRow.setHeightInPoints(22);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(estiloHeader);
            }

            int rowIdx = 1;
            for (Cita c : citas) {
                Row row = detalle.createRow(rowIdx);
                CellStyle base = (rowIdx % 2 == 0) ? estiloCeldaAlterna : estiloCeldaBase;

                setCelda(row, 0, safe(c.getTicket()), base);
                setCelda(row, 1, c.getPadre() != null
                        ? safe(c.getPadre().getNombre() + " " + c.getPadre().getApellido()) : "-", base);
                setCelda(row, 2, c.getDocente() != null
                        ? safe(c.getDocente().getNombre() + " " + c.getDocente().getApellido()) : "-", base);
                setCelda(row, 3, c.getEstudiante() != null
                        ? safe(c.getEstudiante().getNombre() + " " + c.getEstudiante().getApellido()) : "-", base);
                setCelda(row, 4, c.getFecha() != null ? c.getFecha().format(FMT) : "-", base);

                Cell estadoCell = row.createCell(5);
                estadoCell.setCellValue(capitalizar(safe(c.getEstado())));
                estadoCell.setCellStyle(switch (safe(c.getEstado()).toLowerCase()) {
                    case "completada" -> estiloEstadoCompletada;
                    case "confirmada" -> estiloEstadoConfirmada;
                    case "cancelada", "rechazada" -> estiloEstadoCancelada;
                    default -> estiloEstadoOtro;
                });

                setCelda(row, 6, Boolean.TRUE.equals(c.getAsistio()) ? "Sí" : "No", base);
                setCelda(row, 7, safe(c.getMotivo()), base);
                rowIdx++;
            }

            int[] anchos = {4200, 6500, 6500, 6500, 3200, 3800, 2800, 5500};
            for (int i = 0; i < headers.length; i++) {
                detalle.setColumnWidth(i, anchos[i]);
            }

            if (rowIdx > 1) {
                detalle.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, rowIdx - 1, 0, headers.length - 1));
            }
            detalle.createFreezePane(0, 1);

            wb.write(baos);
            String nombre = "reporte_edubot_" + periodo + "_" + LocalDate.now() + ".xlsx";
            return new ResultadoExportacion(baos.toByteArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nombre);

        } catch (IOException e) {
            throw new RuntimeException("Error generando Excel: " + e.getMessage(), e);
        }
    }

    private CellStyle crearEstiloEstado(XSSFWorkbook wb, CellStyle base, IndexedColors color) {
        org.apache.poi.xssf.usermodel.XSSFCellStyle estilo =
                (org.apache.poi.xssf.usermodel.XSSFCellStyle) wb.createCellStyle();
        estilo.cloneStyleFrom(base);
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(color.getIndex());
        estilo.setFont(font);
        estilo.setAlignment(HorizontalAlignment.CENTER);
        return estilo;
    }

    private void setCelda(Row row, int idx, String valor, CellStyle estilo) {
        Cell cell = row.createCell(idx);
        cell.setCellValue(valor);
        cell.setCellStyle(estilo);
    }

    private String capitalizar(String s) {
        if (s == null || s.isBlank()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private ResultadoExportacion exportarCSV(List<Cita> citas, String periodo, String resumenIA) {
        StringBuilder sb = new StringBuilder();

        sb.append("# Reporte EduBot — Período: ").append(periodo.toUpperCase()).append("\n");
        sb.append("# Generado el: ").append(LocalDate.now().format(FMT)).append("\n");
        sb.append("# Resumen IA: ").append(resumenIA.replace("\n", " | ")).append("\n\n");
        sb.append("Ticket;Padre;Docente;Estudiante;Fecha;Estado;Asistio;Motivo\n");

        for (Cita c : citas) {
            sb.append(csv(c.getTicket())).append(";");
            sb.append(csv(c.getPadre() != null ? c.getPadre().getNombre() + " " + c.getPadre().getApellido() : "")).append(";");
            sb.append(csv(c.getDocente() != null
                    ? c.getDocente().getNombre() + " " + c.getDocente().getApellido() : "")).append(";");
            sb.append(csv(c.getEstudiante() != null
                    ? c.getEstudiante().getNombre() + " " + c.getEstudiante().getApellido() : "")).append(";");
            sb.append(csv(c.getFecha() != null ? c.getFecha().format(FMT) : "")).append(";");
            sb.append(csv(c.getEstado())).append(";");
            sb.append(Boolean.TRUE.equals(c.getAsistio()) ? "Si" : "No").append(";");
            sb.append(csv(c.getMotivo())).append("\n");
        }

        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] contenido = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] bytes = new byte[bom.length + contenido.length];
        System.arraycopy(bom, 0, bytes, 0, bom.length);
        System.arraycopy(contenido, 0, bytes, bom.length, contenido.length);

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
                .filter(c -> {
                    LocalDate referencia = c.getCreatedAt() != null
                            ? c.getCreatedAt().toLocalDate()
                            : c.getFecha();
                    return referencia != null
                            && !referencia.isBefore(inicio)
                            && !referencia.isAfter(hoy);
                })
                .sorted((a, b) -> {
                    LocalDateTime ca = a.getCreatedAt();
                    LocalDateTime cb = b.getCreatedAt();
                    if (ca == null || cb == null) return 0;
                    return cb.compareTo(ca); // más recientes primero
                })
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
        if (s.contains(";") || s.contains("\"") || s.contains("\n")) {
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