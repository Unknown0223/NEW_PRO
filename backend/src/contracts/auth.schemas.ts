import { z } from "zod";

/** POST `/auth/login` va `/api/auth/login` tanasi */
export const authLoginBodySchema = z.object({
  slug: z.string().min(1),
  login: z.string().min(1),
  password: z.string().min(1),
  device_name: z.string().max(255).nullable().optional(),
  device_id: z.string().max(64).nullable().optional(),
  user_agent: z.string().max(512).nullable().optional(),
  apk_version: z.string().max(64).nullable().optional()
});

/** POST `/auth/refresh`, `/auth/logout` tanasi — web HttpOnly cookie yoki mobil JSON body */
export const authRefreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional()
});
