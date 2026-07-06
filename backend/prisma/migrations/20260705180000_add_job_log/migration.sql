-- CreateTable
CREATE TABLE "job_log" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER,
    "queue_name" VARCHAR(64) NOT NULL,
    "job_id" VARCHAR(128) NOT NULL,
    "job_name" VARCHAR(128) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "job_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_log_tenant_id_job_name_idx" ON "job_log"("tenant_id", "job_name");

-- CreateIndex
CREATE INDEX "job_log_queue_name_finished_at_idx" ON "job_log"("queue_name", "finished_at");

-- AddForeignKey
ALTER TABLE "job_log" ADD CONSTRAINT "job_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
