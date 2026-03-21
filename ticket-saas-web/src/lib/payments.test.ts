import { describe, expect, it } from "vitest";
import {
  buildJarPaymentUrl,
  isOrderExpired,
  isOrderPaid,
  toOrderPublicSnapshot,
} from "./payments";

describe("payments service", () => {
  it("detects paid orders from payment, tickets, or status", () => {
    expect(isOrderPaid({ status: "awaiting_payment", payment: { id: "p1" }, tickets: [] })).toBe(true);
    expect(
      isOrderPaid({
        status: "awaiting_payment",
        payment: null,
        tickets: [{ id: "t1", usedAt: null, usedBy: null }],
      })
    ).toBe(true);
    expect(isOrderPaid({ status: "paid", payment: null, tickets: [] })).toBe(true);
    expect(isOrderPaid({ status: "awaiting_payment", payment: null, tickets: [] })).toBe(false);
  });

  it("detects expired orders relative to provided time", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    expect(isOrderExpired({ expiresAt: new Date("2026-03-15T11:59:59.000Z") }, now)).toBe(true);
    expect(isOrderExpired({ expiresAt: new Date("2026-03-15T12:00:01.000Z") }, now)).toBe(false);
  });

  it("builds jar payment URL only when a jar/account id exists", () => {
    expect(buildJarPaymentUrl("jar-1", 12345)).toBe("https://send.monobank.ua/jar/jar-1?amount=123.45");
    expect(buildJarPaymentUrl(null, 12345)).toBeNull();
  });

  it("maps order data to the public snapshot", () => {
    const snapshot = toOrderPublicSnapshot(
      {
        id: "order-1",
        status: "paid",
        amountExpectedCents: 4567,
        expiresAt: new Date("2026-03-15T13:00:00.000Z"),
        payment: { id: "payment-1" },
        tickets: [{ id: "ticket-1", usedAt: null, usedBy: null }],
        event: { monoJarId: "jar-1", monoAccountId: "account-1" },
      },
      new Date("2026-03-15T12:00:00.000Z")
    );

    expect(snapshot).toEqual({
      id: "order-1",
      status: "paid",
      amountExpectedCents: 4567,
      amountHuman: "45.67",
      expiresAt: "2026-03-15T13:00:00.000Z",
      isExpired: false,
      hasPayment: true,
      hasTicket: true,
      jarPaymentUrl: "https://send.monobank.ua/jar/jar-1?amount=45.67",
      tickets: [{ id: "ticket-1", usedAt: null, usedBy: null }],
    });
  });
});
