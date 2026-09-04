-- SVR team: agent work-slot ids on supervisor slots
ALTER TABLE "work_slots" ADD COLUMN IF NOT EXISTS "supervisee_agent_slot_ids" INTEGER[] NOT NULL DEFAULT '{}';
