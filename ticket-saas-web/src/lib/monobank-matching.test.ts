import { describe, expect, it } from "vitest";
import { matchTransactionsToOrders } from "./monobank-matching";

describe("monobank matching", () => {
  it("matches by exact amount and positive direction for direct account polling", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [{ id: "order-1", amountExpectedCents: 12345 }],
      statement: [{ id: "tx-1", amount: 12345, currencyCode: 980, time: 1 }],
      usedDefaultAccount: false,
    });

    expect(result).toEqual([
      {
        orderId: "order-1",
        transactions: [{ id: "tx-1", amount: 12345, currencyCode: 980, time: 1 }],
      },
    ]);
  });

  it("matches by negative direction for default account fallback", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [{ id: "order-1", amountExpectedCents: 12345 }],
      statement: [{ id: "tx-1", amount: -12345, currencyCode: 980, time: 1 }],
      usedDefaultAccount: true,
    });

    expect(result[0]?.transactions[0]?.id).toBe("tx-1");
  });

  it("prefers explicit order id mention in description", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [{ id: "order-1", amountExpectedCents: 12345 }],
      statement: [
        { id: "tx-1", amount: -12345, currencyCode: 980, time: 1, description: "payment order-1" },
      ],
      usedDefaultAccount: false,
    });

    expect(result[0]?.transactions[0]?.id).toBe("tx-1");
  });

  it("skips non-UAH and already-used operations", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [{ id: "order-1", amountExpectedCents: 12345 }],
      statement: [
        { id: "tx-used", amount: 12345, currencyCode: 980, time: 1 },
        { id: "tx-foreign", amount: 12345, currencyCode: 840, time: 2 },
        { id: "tx-good", amount: 12345, currencyCode: 980, time: 3 },
      ],
      usedOperationIds: new Set(["tx-used"]),
      usedDefaultAccount: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.transactions[0]?.id).toBe("tx-good");
  });

  it("does not reuse one transaction for multiple orders", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [
        { id: "order-1", amountExpectedCents: 12345 },
        { id: "order-2", amountExpectedCents: 12345 },
      ],
      statement: [{ id: "tx-1", amount: 12345, currencyCode: 980, time: 1 }],
      usedDefaultAccount: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.orderId).toBe("order-1");
  });

  it("matches split payments when their sum equals the order amount", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [{ id: "order-1", amountExpectedCents: 40045 }],
      statement: [
        { id: "tx-1", amount: 40000, currencyCode: 980, time: 1 },
        { id: "tx-2", amount: 45, currencyCode: 980, time: 2 },
      ],
      usedDefaultAccount: false,
    });

    expect(result).toEqual([
      {
        orderId: "order-1",
        transactions: [
          { id: "tx-1", amount: 40000, currencyCode: 980, time: 1 },
          { id: "tx-2", amount: 45, currencyCode: 980, time: 2 },
        ],
      },
    ]);
  });

  it("does not auto-match ambiguous split combinations", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [{ id: "order-1", amountExpectedCents: 100 }],
      statement: [
        { id: "tx-1", amount: 60, currencyCode: 980, time: 1 },
        { id: "tx-2", amount: 40, currencyCode: 980, time: 2 },
        { id: "tx-3", amount: 70, currencyCode: 980, time: 3 },
        { id: "tx-4", amount: 30, currencyCode: 980, time: 4 },
      ],
      usedDefaultAccount: false,
    });

    expect(result).toEqual([]);
  });

  it("does not match transactions outside the order payment window", () => {
    const result = matchTransactionsToOrders({
      pendingOrders: [
        {
          id: "order-1",
          amountExpectedCents: 300,
          createdAt: new Date("2026-03-15T10:00:00.000Z"),
          expiresAt: new Date("2026-03-15T10:15:00.000Z"),
        },
      ],
      statement: [{ id: "tx-1", amount: 300, currencyCode: 980, time: Date.parse("2026-03-15T12:00:00.000Z") / 1000 }],
      usedDefaultAccount: false,
    });

    expect(result).toEqual([]);
  });
});
