-- CORRECT direction: agent/docs are source of truth; fix client region/city/zone.
-- Do NOT move orders/payments/agents to match GPS.
--
-- Prerequisites (ops): load bak9 snapshot of clients(id,agent_id,region,city,zone,name),
-- orders(id,client_id,agent_id,status), pays(id,client_id,cash_desk_id,ledger_agent_id,deleted_at)
-- from a pre-wrong-fix dump if agents/kassa were previously swapped the wrong way.

BEGIN;

-- Optional: restore agents/kassa from bak9 if a wrong-direction fix was applied.
-- UPDATE orders o SET agent_id = b.agent_id FROM bak9.orders b
-- WHERE o.id = b.id AND o.agent_id IS DISTINCT FROM b.agent_id;
-- UPDATE client_payments p SET cash_desk_id = b.cash_desk_id, ledger_agent_id = b.ledger_agent_id
-- FROM bak9.pays b WHERE p.id = b.id
--   AND (p.cash_desk_id IS DISTINCT FROM b.cash_desk_id OR p.ledger_agent_id IS DISTINCT FROM b.ledger_agent_id);

CREATE TEMP TABLE agent_terr AS
SELECT
  u.id AS agent_id,
  u.code AS agent_code,
  CASE
    WHEN u.code ILIKE 'PMAND%' OR u.code ILIKE 'PMNAM%' OR u.code ILIKE 'PMFAR%' OR u.code ILIKE 'PMQQ%' THEN 'FV'
    WHEN u.code ILIKE 'PMXRZ%' OR u.code ILIKE 'PMSM%' OR u.code ILIKE 'PMBX%' OR u.code ILIKE 'PMNAV%' THEN 'SOUTH-WEST'
  END AS zone,
  CASE
    WHEN u.code ILIKE 'PMAND%' THEN 'ANDIJON VILOYATI'
    WHEN u.code ILIKE 'PMNAM%' THEN 'NAMANGAN VILOYATI'
    WHEN u.code ILIKE 'PMFAR%' THEN 'FARGONA VILOYATI'
    WHEN u.code ILIKE 'PMQQ%' THEN 'QOQON SHAXAR'
    WHEN u.code ILIKE 'PMXRZ%' THEN 'XORAZM VILOYATI'
    WHEN u.code ILIKE 'PMSM%' THEN 'SAMARQAND VILOYATI'
    WHEN u.code ILIKE 'PMBX%' THEN 'BUXORO VILOYATI'
    WHEN u.code ILIKE 'PMNAV%' THEN 'NAVOIY VILOYATI'
  END AS region,
  NULLIF(
    trim(BOTH ' /' FROM reverse(split_part(reverse(COALESCE(ws.territory, '')), ' / ', 1))),
    ''
  ) AS city_raw
FROM users u
LEFT JOIN work_slots ws ON ws.slot_code = u.code AND ws.deleted_at IS NULL
WHERE u.code ~ '^(PMAND|PMNAM|PMFAR|PMQQ|PMXRZ|PMSM|PMBX|PMNAV)';

UPDATE agent_terr
SET city_raw = CASE
  WHEN agent_code ILIKE 'PMAND%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'AD\_%' ESCAPE '\' THEN 'AD_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMNAM%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'NM\_%' ESCAPE '\' THEN 'NM_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMFAR%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'FR\_%' ESCAPE '\' THEN 'FR_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMQQ%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'QQ\_%' ESCAPE '\' THEN 'QQ_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMXRZ%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'XR\_%' ESCAPE '\' THEN 'XR_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMSM%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'SM\_%' ESCAPE '\' THEN 'SM_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMBX%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'BX\_%' ESCAPE '\' THEN 'BX_' || replace(upper(city_raw), ' ', '_')
  WHEN agent_code ILIKE 'PMNAV%' AND city_raw IS NOT NULL AND city_raw NOT ILIKE 'NV\_%' ESCAPE '\' THEN 'NV_' || replace(upper(city_raw), ' ', '_')
  ELSE upper(replace(city_raw, ' ', '_'))
END;

-- True agent = dominant PM* order agent, else payment ledger, else current PM* agent
CREATE TEMP TABLE client_true_agent AS
SELECT
  c.id AS client_id,
  COALESCE(
    (
      SELECT o.agent_id
      FROM orders o
      JOIN agent_terr at ON at.agent_id = o.agent_id
      WHERE o.client_id = c.id
        AND o.status <> 'cancelled'
        AND o.order_type = 'order'
      GROUP BY o.agent_id
      ORDER BY COUNT(*) DESC, MAX(o.id) DESC
      LIMIT 1
    ),
    (
      SELECT p.ledger_agent_id
      FROM client_payments p
      JOIN agent_terr at ON at.agent_id = p.ledger_agent_id
      WHERE p.client_id = c.id
        AND p.deleted_at IS NULL
      GROUP BY p.ledger_agent_id
      ORDER BY COUNT(*) DESC, MAX(p.id) DESC
      LIMIT 1
    ),
    CASE
      WHEN EXISTS (SELECT 1 FROM agent_terr at WHERE at.agent_id = c.agent_id) THEN c.agent_id
    END
  ) AS true_agent_id
FROM clients c
WHERE c.merged_into_client_id IS NULL;

DELETE FROM client_true_agent WHERE true_agent_id IS NULL;

UPDATE clients c
SET agent_id = t.true_agent_id
FROM client_true_agent t
WHERE c.id = t.client_id
  AND c.agent_id IS DISTINCT FROM t.true_agent_id;

-- ONLY when client.region mismatches agent region: set zone/region/city from agent slot
UPDATE clients c
SET
  zone = at.zone,
  region = at.region,
  city = at.city_raw
FROM client_true_agent t,
     agent_terr at
WHERE c.id = t.client_id
  AND at.agent_id = t.true_agent_id
  AND at.region IS NOT NULL
  AND c.region IS DISTINCT FROM at.region;

COMMIT;
