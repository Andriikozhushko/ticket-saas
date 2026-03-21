import { z } from "zod";

const roleSchema = z.enum(["user", "organizer", "admin"], { message: "РќРµРІС–СЂРЅР° СЂРѕР»ь" });

export const createUserBodySchema = z.object({
  email: z.string().trim().min(1, "Email РѕР±РѕРІКјСЏР·РєРѕРІРёР№").email("РќРµРІС–СЂРЅРёР№ С„РѕСЂРјР°С‚ email").transform((s) => s.toLowerCase()),
  role: roleSchema.default("user"),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;

