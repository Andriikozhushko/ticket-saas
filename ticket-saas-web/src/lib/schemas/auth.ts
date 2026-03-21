import { z } from "zod";

const emailSchema = z.string().trim().email("РќРµРІС–СЂРЅРёР№ С„РѕСЂРјР°С‚ email.");

export const sendCodeBodySchema = z.object({
  email: emailSchema,
  token: z.string().trim().optional(),
});

export const verifyBodySchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, "Р’РєР°Р¶С–С‚ь РєРѕРґ."),
});

export type SendCodeBody = z.infer<typeof sendCodeBodySchema>;
export type VerifyBody = z.infer<typeof verifyBodySchema>;

