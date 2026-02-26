import { z } from "zod";

const emailSchema = z.string().trim().email("Невірний формат email");

export const sendCodeBodySchema = z.object({
  email: emailSchema,
  token: z.string().trim().min(1, "Підтвердіть, що ви не робот (капча)"),
});

export const verifyBodySchema = z.object({
  email: emailSchema,
  code: z.string().min(1, "Вкажіть код"),
});

export type SendCodeBody = z.infer<typeof sendCodeBodySchema>;
export type VerifyBody = z.infer<typeof verifyBodySchema>;
