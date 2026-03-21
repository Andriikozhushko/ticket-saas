import { z } from "zod";

export const createOrderBodySchema = z.object({
  eventId: z.string().trim().min(1, "Оберіть подію"),
  email: z.string().trim().optional(),
  ticketTypeId: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
