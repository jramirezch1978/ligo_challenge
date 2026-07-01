-- ============================================================================
-- Wallet Transaction Service - Datos de prueba (seed)
-- Precarga wallets demo para que la API sea usable inmediatamente, cubriendo
-- los ejemplos del contrato del challenge (wal_001, wal_002) y los casos
-- borde documentados (moneda distinta, wallet bloqueada).
-- ============================================================================

INSERT INTO wallets (id, "currency", "availableBalance", status, "ownerName")
VALUES
  ('wal_001', 'PEN', 1500.00, 'ACTIVE', 'Juan Perez'),
  ('wal_002', 'PEN', 500.00, 'ACTIVE', 'Maria Lopez'),
  ('wal_003', 'USD', 200.00, 'ACTIVE', 'Carlos Gomez'),
  ('wal_004', 'PEN', 300.00, 'BLOCKED', 'Ana Torres')
ON CONFLICT (id) DO NOTHING;
