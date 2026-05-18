CREATE TABLE "roles" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "key" VARCHAR(100) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "key")
);

CREATE TABLE "permissions" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "key" VARCHAR(180) NOT NULL,
  "module" VARCHAR(120) NOT NULL,
  "section" VARCHAR(120),
  "action" VARCHAR(120),
  "description" TEXT,
  "risk_level" VARCHAR(16) NOT NULL DEFAULT 'low',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "key")
);

CREATE TABLE "role_permissions" (
  "role_id" INTEGER NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" INTEGER NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "user_roles" (
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role_id" INTEGER NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "user_permissions" (
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "permission_id" INTEGER NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "effect" VARCHAR(16) NOT NULL DEFAULT 'allow',
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "permission_id")
);

CREATE TABLE "user_branches" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "branch_code" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "user_id", "branch_code")
);

CREATE TABLE "user_payment_methods" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "payment_method" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "user_id", "payment_method")
);

CREATE TABLE "access_logs" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "actor_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "target_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "action_type" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" VARCHAR(80) NOT NULL,
  "old_value" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "new_value" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ip_address" VARCHAR(64),
  "device" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "roles_tenant_key_idx" ON "roles" ("tenant_id", "key");
CREATE INDEX "permissions_tenant_module_idx" ON "permissions" ("tenant_id", "module");
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" ("permission_id");
CREATE INDEX "user_roles_role_idx" ON "user_roles" ("role_id");
CREATE INDEX "user_permissions_permission_idx" ON "user_permissions" ("permission_id");
CREATE INDEX "user_permissions_effect_idx" ON "user_permissions" ("effect");
CREATE INDEX "user_branches_tenant_branch_idx" ON "user_branches" ("tenant_id", "branch_code");
CREATE INDEX "user_branches_user_idx" ON "user_branches" ("user_id");
CREATE INDEX "user_payment_methods_tenant_method_idx" ON "user_payment_methods" ("tenant_id", "payment_method");
CREATE INDEX "user_payment_methods_user_idx" ON "user_payment_methods" ("user_id");
CREATE INDEX "access_logs_tenant_created_idx" ON "access_logs" ("tenant_id", "created_at" DESC);
CREATE INDEX "access_logs_tenant_action_idx" ON "access_logs" ("tenant_id", "action_type");
CREATE INDEX "access_logs_tenant_actor_idx" ON "access_logs" ("tenant_id", "actor_user_id");
CREATE INDEX "access_logs_tenant_target_idx" ON "access_logs" ("tenant_id", "target_user_id");
