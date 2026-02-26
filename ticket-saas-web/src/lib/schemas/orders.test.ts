import { describe, it, expect } from "vitest";
import { createOrderBodySchema } from "./orders";

describe("createOrderBodySchema", () => {
  it("accepts minimal valid body (eventId, default quantity)", () => {
    const result = createOrderBodySchema.safeParse({
      eventId: "evt-uuid-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventId).toBe("evt-uuid-123");
      expect(result.data.quantity).toBe(1);
      expect(result.data.email).toBeUndefined();
      expect(result.data.ticketTypeId).toBeUndefined();
    }
  });

  it("accepts full body", () => {
    const result = createOrderBodySchema.safeParse({
      eventId: "evt-1",
      email: "buyer@example.com",
      ticketTypeId: "tt-1",
      quantity: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
      expect(result.data.email).toBe("buyer@example.com");
      expect(result.data.ticketTypeId).toBe("tt-1");
    }
  });

  it("clamps quantity to 1-20", () => {
    expect(createOrderBodySchema.safeParse({ eventId: "e", quantity: 0 }).success).toBe(false);
    expect(createOrderBodySchema.safeParse({ eventId: "e", quantity: 21 }).success).toBe(false);
    const r = createOrderBodySchema.safeParse({ eventId: "e", quantity: 5 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(5);
  });

  it("rejects empty eventId", () => {
    const result = createOrderBodySchema.safeParse({
      eventId: "",
    });
    expect(result.success).toBe(false);
  });
});
