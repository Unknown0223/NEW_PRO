import { z } from "zod";

/** POST `/auth/login` va `/api/auth/login` tanasi */
export const authLoginBodySchema = z.object({
  slug: z.string().min(1),
  login: z.string().min(1),
  password: z.string().min(1),
  device_name: z.string().max(255).nullable().optional(),
  user_agent: z.string().max(512).nullable().optional()
});

/** POST `/auth/refresh`, `/auth/logout` tanasi */
export const authRefreshBodySchema = z.object({
  refreshToken: z.string().min(1)
});
