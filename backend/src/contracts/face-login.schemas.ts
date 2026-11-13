import { z } from "zod";

export const faceLoginVerifyBodySchema = z.object({
  challenge_token: z.string().min(16).max(128),
  image_base64: z.string().min(32).max(2_500_000),
  liveness_steps: z.array(z.union([z.string(), z.object({ dir: z.string() })])).min(1).max(16),
  channel: z.enum(["webcam", "qr_phone"]).optional(),
  landmarks: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .min(100)
    .max(600)
    .optional()
});

export const faceLoginStatusQuerySchema = z.object({
  challenge_token: z.string().min(16).max(128)
});

export const faceLoginCompleteBodySchema = z.object({
  challenge_token: z.string().min(16).max(128)
});

/** Muddati o‘tgan/pending challenge uchun yangi QR (parolsiz). */
export const faceLoginRecreateBodySchema = z.object({
  challenge_token: z.string().min(16).max(128)
});
