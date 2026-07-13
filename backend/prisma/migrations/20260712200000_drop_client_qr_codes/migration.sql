-- Client QR codes feature removed
DROP TABLE IF EXISTS "client_qr_codes";

-- Orphan RBAC keys for removed QR section
DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "key" LIKE 'clients.qr_kody%'
);
DELETE FROM "user_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "key" LIKE 'clients.qr_kody%'
);
DELETE FROM "permissions" WHERE "key" LIKE 'clients.qr_kody%';
