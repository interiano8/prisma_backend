-- Seed base para el e2e transaccional (prisma_e2e). Idempotente.
INSERT INTO tiendas (id_tienda, emisor, turnos) VALUES ('001', 'PRISMA', 99)
  ON CONFLICT (id_tienda) DO NOTHING;

INSERT INTO series_documento (numero_linea, codigo_serie, id_tienda, codigo_pos, fecha_inicio, numero_inicio, numero_fin, ultimo_numero_usado, abierta, cai, fecha_vence_rango, en_edicion)
VALUES
  (1, 'FV-HN', '001', '01', now() - interval '1 day', 'FV0000000000000001', 'FV0000000000009999', 'FV0000000000000000', true, 'CAI-TEST', '2027-01-01', false),
  (1, 'TR-ID', '001', '01', now() - interval '1 day', 'TR0000000000000001', 'TR0000000000009999', 'TR0000000000000000', true, NULL, NULL, false),
  (1, 'NC-HN', '001', '01', now() - interval '1 day', 'NC0000000000000001', 'NC0000000000009999', 'NC0000000000000000', true, NULL, NULL, false)
  ON CONFLICT (numero_linea, codigo_serie) DO NOTHING;

INSERT INTO metodos_pago (codigo, descripcion, categoria, moneda)
VALUES ('CASH', 'EFECTIVO', 'EFECTIVO', 'HNL')
  ON CONFLICT (codigo) DO NOTHING;

INSERT INTO categorias_producto (codigo, descripcion)
VALUES ('', 'SIN CATEGORIA')
  ON CONFLICT (codigo) DO NOTHING;

INSERT INTO empleados (usuario, nombre, esta_activo)
VALUES ('e2e', 'e2e', true)
  ON CONFLICT (usuario) DO NOTHING;

INSERT INTO turnos (id_transaccion_pos, id_tienda, codigo_pos, turno, id_dia_semana, inicio_turno, fin_turno, importe_contado, nombre_empleado, monto_inicial)
VALUES ('TR-E2E-0001', '001', '01', '1', 1, now(), NULL, 0, 'e2e', 0)
  ON CONFLICT (id_transaccion_pos) DO NOTHING;