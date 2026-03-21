import { z } from "zod";

const roleSchema = z.enum(["user", "organizer", "admin"], { message: "Невірна роль" });

export const createUserBodySchema = z.object({
  email: z.string().trim().min(1, "Email обовʼязковий").email("Невірний формат email").transform((s) => s.toLowerCase()),
  role: roleSchema.default("user"),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
