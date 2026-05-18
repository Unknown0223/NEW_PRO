import type { FastifyInstance } from "fastify";
import { registerBonusRuleLifecycleRoutes } from "./bonus-rules.route.lifecycle";
import { registerBonusRuleListRoutes } from "./bonus-rules.route.list";
import { registerBonusRuleReadRoutes } from "./bonus-rules.route.read";
import { registerBonusRuleWriteRoutes } from "./bonus-rules.route.write";

export async function registerBonusRuleRoutes(app: FastifyInstance) {
  await registerBonusRuleListRoutes(app);
  await registerBonusRuleReadRoutes(app);
  await registerBonusRuleWriteRoutes(app);
  await registerBonusRuleLifecycleRoutes(app);
}
