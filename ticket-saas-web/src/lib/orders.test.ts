import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  ticketType: {
    findMany: vi.fn(),
  },
  order: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  ticket: {
    createMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createAwaitingPaymentOrder,
  issuePaidOrderWithTickets,
  resolveBuyerEmail,
  resolveOrderPrice,
} from "./orders";

describe("orders service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers session email and normalizes it", () => {
    expect(resolveBuyerEmail("  USER@Example.COM ", "ignored@example.com")).toBe("user@example.com");
  });

  it("uses raw email when there is no session", () => {
    expect(resolveBuyerEmail(null, " Buyer@Example.com ")).toBe("buyer@example.com");
  });

  it("returns empty string for invalid raw email", () => {
    expect(resolveBuyerEmail(null, "not-an-email")).toBe("");
  });

  it("resolves ticket type price by selected ticket type", async () => {
    prismaMock.ticketType.findMany.mockResolvedValue([
      { id: "standard", priceCents: 5000 },
      { id: "vip", priceCents: 9000 },
    ]);

    await expect(resolveOrderPrice("event-1", 4500, "vip")).resolves.toBe(9000);
  });

  it("falls back to the first ticket type or event price", async () => {
    prismaMock.ticketType.findMany.mockResolvedValue([{ id: "standard", priceCents: 5000 }]);
    await expect(resolveOrderPrice("event-1", 4500, null)).resolves.toBe(5000);

    prismaMock.ticketType.findMany.mockResolvedValue([]);
    await expect(resolveOrderPrice("event-1", 4500, null)).resolves.toBe(4500);
  });

  it("retries order creation until a free amount is found", async () => {
    prismaMock.order.create
      .mockRejectedValueOnce(new Error("duplicate amount"))
      .mockResolvedValueOnce({
        id: "order-1",
        amountExpectedCents: 10042,
      });

    const result = await createAwaitingPaymentOrder({
      eventId: "event-1",
      buyerEmail: "buyer@example.com",
      quantity: 2,
      ticketTypeId: "vip",
      priceCents: 5000,
    });

    expect(prismaMock.order.create).toHaveBeenCalledTimes(2);
    expect(result.orderId).toBe("order-1");
    expect(result.amountExpectedCents).toBe(10042);
    expect(result.amountHuman).toBe("100.42");
  });

  it("creates a paid order with a negative synthetic amount and issues tickets", async () => {
    prismaMock.order.findFirst.mockResolvedValue({ amountExpectedCents: 12001 });
    prismaMock.order.create.mockResolvedValue({ id: "paid-order-1" });
    prismaMock.ticket.createMany.mockResolvedValue({ count: 3 });

    const orderId = await issuePaidOrderWithTickets({
      eventId: "event-1",
      buyerEmail: "buyer@example.com",
      quantity: 3,
    });

    expect(orderId).toBe("paid-order-1");
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "event-1",
          buyerEmail: "buyer@example.com",
          quantity: 3,
          status: "paid",
          amountExpectedCents: -1,
        }),
      })
    );
    expect(prismaMock.ticket.createMany).toHaveBeenCalledWith({
      data: [
        { orderId: "paid-order-1" },
        { orderId: "paid-order-1" },
        { orderId: "paid-order-1" },
      ],
    });
  });
});
