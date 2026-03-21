import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  ticket: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { consumeTicket } from "./tickets";

describe("tickets service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a fresh ticket as used", async () => {
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.ticket.findUnique.mockResolvedValue({
      id: "ticket-1",
      usedAt: new Date("2026-03-15T10:00:00.000Z"),
      usedBy: "scanner@example.com",
    });

    const result = await consumeTicket("ticket-1", "scanner@example.com");

    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: "ticket-1", usedAt: null },
      data: { usedAt: expect.any(Date), usedBy: "scanner@example.com" },
    });
    expect(result).toEqual({
      ok: true,
      ticket: {
        id: "ticket-1",
        usedAt: new Date("2026-03-15T10:00:00.000Z"),
        usedBy: "scanner@example.com",
      },
    });
  });

  it("returns not_found when the ticket does not exist", async () => {
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const result = await consumeTicket("missing-ticket", "scanner@example.com");

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns already_used when another scan won the race", async () => {
    const usedTicket = {
      id: "ticket-1",
      usedAt: new Date("2026-03-15T10:00:00.000Z"),
      usedBy: "first-scanner@example.com",
    };
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.ticket.findUnique.mockResolvedValue(usedTicket);

    const result = await consumeTicket("ticket-1", "second-scanner@example.com");

    expect(result).toEqual({
      ok: false,
      reason: "already_used",
      ticket: usedTicket,
    });
  });
});
