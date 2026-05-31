-- ============================================================
-- EduBot — Script 02: Datos de prueba (seed)
-- INSTRUCCIONES: Ejecuta este script DESPUÉS del 01
-- ============================================================

-- ── Docentes ─────────────────────────────────────────────────
INSERT INTO docentes (nombre, apellido, curso, activo) VALUES
('García',  'Torres', 'Matemáticas',  TRUE),
('López',   'Ríos',   'Comunicación', TRUE),
('Torres',  'Medina', 'Ciencias',     TRUE)
ON CONFLICT DO NOTHING;

-- ── Padres de familia ────────────────────────────────────────
-- DNIs de prueba para usar en el chat: 12345678 / 87654321 / 11223344
INSERT INTO padres (dni, nombre, apellido, telefono, horario_laboral) VALUES
('12345678', 'Rosa',   'Mamani', '987654321', 'tarde'),
('87654321', 'Carlos', 'Quispe', '912345678', 'manana'),
('11223344', 'María',  'Flores', '998877665', 'tarde')
ON CONFLICT (dni) DO NOTHING;

-- ── Estudiantes ──────────────────────────────────────────────
INSERT INTO estudiantes (nombre, apellido, grado, seccion, padre_id) VALUES
('Luis',  'Mamani', '3ro', 'A', 1),
('Ana',   'Quispe', '2do', 'B', 2),
('Pedro', 'Flores', '4to', 'A', 3)
ON CONFLICT DO NOTHING;

-- ── Disponibilidad de docentes (próximas 2 semanas) ──────────
-- Prof. García (id=1)
INSERT INTO disponibilidad_docente (docente_id, fecha, hora_inicio, hora_fin, disponible) VALUES
(1, CURRENT_DATE + 1,  '14:00', '14:30', TRUE),
(1, CURRENT_DATE + 1,  '14:30', '15:00', TRUE),
(1, CURRENT_DATE + 1,  '15:00', '15:30', TRUE),
(1, CURRENT_DATE + 2,  '15:30', '16:00', TRUE),
(1, CURRENT_DATE + 3,  '14:00', '14:30', TRUE),
(1, CURRENT_DATE + 3,  '16:00', '16:30', TRUE),
(1, CURRENT_DATE + 5,  '13:00', '13:30', TRUE),
(1, CURRENT_DATE + 7,  '14:00', '14:30', TRUE),
(1, CURRENT_DATE + 8,  '15:00', '15:30', TRUE),
(1, CURRENT_DATE + 10, '14:30', '15:00', TRUE);

-- Prof. López (id=2)
INSERT INTO disponibilidad_docente (docente_id, fecha, hora_inicio, hora_fin, disponible) VALUES
(2, CURRENT_DATE + 1,  '10:00', '10:30', TRUE),
(2, CURRENT_DATE + 1,  '10:30', '11:00', TRUE),
(2, CURRENT_DATE + 2,  '11:00', '11:30', TRUE),
(2, CURRENT_DATE + 4,  '10:30', '11:00', TRUE),
(2, CURRENT_DATE + 4,  '11:00', '11:30', TRUE),
(2, CURRENT_DATE + 6,  '10:00', '10:30', TRUE),
(2, CURRENT_DATE + 8,  '11:30', '12:00', TRUE),
(2, CURRENT_DATE + 9,  '10:00', '10:30', TRUE);

-- Prof. Torres (id=3)
INSERT INTO disponibilidad_docente (docente_id, fecha, hora_inicio, hora_fin, disponible) VALUES
(3, CURRENT_DATE + 1,  '08:00', '08:30', TRUE),
(3, CURRENT_DATE + 2,  '08:30', '09:00', TRUE),
(3, CURRENT_DATE + 3,  '09:00', '09:30', TRUE),
(3, CURRENT_DATE + 5,  '08:00', '08:30', TRUE),
(3, CURRENT_DATE + 7,  '09:00', '09:30', TRUE),
(3, CURRENT_DATE + 9,  '08:30', '09:00', TRUE);

-- ── Historial de citas pasadas (para que la IA tenga datos) ──
INSERT INTO citas (ticket, padre_id, docente_id, estudiante_id, fecha, hora_inicio, hora_fin, motivo, estado, asistio, satisfaccion) VALUES
('EDU-0031', 1, 1, 1, CURRENT_DATE - 30, '15:30', '16:00', 'rendimiento', 'completada', TRUE,  5),
('EDU-0018', 1, 1, 1, CURRENT_DATE - 60, '14:00', '14:30', 'conducta',    'completada', TRUE,  4),
('EDU-0005', 1, 2, 1, CURRENT_DATE - 90, '11:00', '11:30', 'rendimiento', 'completada', FALSE, NULL),
('EDU-0042', 2, 2, 2, CURRENT_DATE - 15, '10:00', '10:30', 'rendimiento', 'completada', TRUE,  5),
('EDU-0038', 2, 3, 2, CURRENT_DATE - 45, '08:00', '08:30', 'conducta',    'completada', TRUE,  3),
('EDU-0022', 3, 1, 3, CURRENT_DATE - 20, '14:30', '15:00', 'matricula',   'completada', TRUE,  4)
ON CONFLICT (ticket) DO NOTHING;

