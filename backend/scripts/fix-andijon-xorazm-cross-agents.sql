-- Andijon agent → Xorazm klient cross-fix (GPS Xorazm tasdiqlangan)
-- Ombor (warehouse_id) tegilmaydi — faqat agent_id / ledger_agent / kassa.

BEGIN;

-- 64068 XOJAYEVA SAYYORA → agent 42 Saitnazarov, kassa 6 Xorazm
UPDATE orders
SET agent_id = 42
WHERE client_id = 64068
  AND agent_id = 11
  AND status <> 'cancelled';

UPDATE client_payments
SET cash_desk_id = 6,
    ledger_agent_id = 42
WHERE client_id = 64068
  AND deleted_at IS NULL
  AND (cash_desk_id IS DISTINCT FROM 6 OR COALESCE(ledger_agent_id, 0) <> 42);

-- 64417 NOMOZVA NARGIZA → agent 41 Tojiboyev
UPDATE orders
SET agent_id = 41
WHERE client_id = 64417
  AND agent_id = 12
  AND status <> 'cancelled';

UPDATE client_payments
SET cash_desk_id = 6,
    ledger_agent_id = 41
WHERE client_id = 64417
  AND deleted_at IS NULL
  AND (cash_desk_id IS DISTINCT FROM 6 OR COALESCE(ledger_agent_id, 0) <> 41);

-- 62654 XIVA PADVAL DUKAN → agent 40 Zulfiya
UPDATE orders
SET agent_id = 40
WHERE client_id = 62654
  AND agent_id = 10
  AND status <> 'cancelled';

UPDATE client_payments
SET cash_desk_id = 6,
    ledger_agent_id = 40
WHERE client_id = 62654
  AND deleted_at IS NULL
  AND (cash_desk_id IS DISTINCT FROM 6 OR COALESCE(ledger_agent_id, 0) <> 40);

UPDATE clients
SET agent_id = 40
WHERE id = 62654 AND (agent_id IS NULL OR agent_id <> 40);

-- 62867 BALTAYEV HOSIYAT → agent 42 Saitnazarov
UPDATE orders
SET agent_id = 42
WHERE client_id = 62867
  AND agent_id = 6
  AND status <> 'cancelled';

UPDATE client_payments
SET cash_desk_id = 6,
    ledger_agent_id = 42
WHERE client_id = 62867
  AND deleted_at IS NULL
  AND (cash_desk_id IS DISTINCT FROM 6 OR COALESCE(ledger_agent_id, 0) <> 42);

UPDATE clients
SET agent_id = 42
WHERE id = 62867 AND (agent_id IS NULL OR agent_id <> 42);

COMMIT;
