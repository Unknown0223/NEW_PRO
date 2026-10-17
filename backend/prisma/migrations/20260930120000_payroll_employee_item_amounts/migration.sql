-- Базовые оклады: xodim bo'yicha надбавка qismlari ({ "<item_id>": amount }).
ALTER TABLE "payroll_employee_configs" ADD COLUMN IF NOT EXISTS "item_amounts" JSONB NOT NULL DEFAULT '{}';
