import type { StatementItem } from "@/lib/monobank-shared-poll";

export type MatchableOrder = {
  id: string;
  amountExpectedCents: number;
  createdAt?: Date;
  expiresAt?: Date;
};

export type MatchCandidate = {
  orderId: string;
  transactions: StatementItem[];
};

const MAX_SPLIT_PARTS = 3;

function isUahTransaction(item: StatementItem): boolean {
  return item.currencyCode === 980 || item.currencyCode === undefined;
}

function getSignedAmount(item: StatementItem): number {
  return item.operationAmount ?? item.amount;
}

function matchesDirection(item: StatementItem, usedDefaultAccount: boolean): boolean {
  const amount = getSignedAmount(item);
  return usedDefaultAccount ? amount < 0 : amount > 0;
}

function transactionMentionsOrder(item: StatementItem, orderId: string): boolean {
  const description = String((item.description ?? "") + (item.comment ?? ""));
  return description.includes(orderId);
}

function isEligibleTransaction(
  item: StatementItem,
  order: MatchableOrder,
  usedOperationIds: Set<string>,
  usedInBatch: Set<string>,
  usedDefaultAccount: boolean
): boolean {
  if (!isUahTransaction(item)) {
    return false;
  }
  if (usedOperationIds.has(item.id) || usedInBatch.has(item.id)) {
    return false;
  }
  if (!isWithinOrderTimeWindow(item, order)) {
    return false;
  }
  if (transactionMentionsOrder(item, order.id)) {
    return true;
  }
  return matchesDirection(item, usedDefaultAccount);
}

function isWithinOrderTimeWindow(item: StatementItem, order: MatchableOrder): boolean {
  if (!order.createdAt && !order.expiresAt) {
    return true;
  }

  const transactionTimeMs = item.time * 1000;
  const fromMs = (order.createdAt?.getTime() ?? transactionTimeMs) - 5 * 60 * 1000;
  const toMs = (order.expiresAt?.getTime() ?? transactionTimeMs) + 10 * 60 * 1000;
  return transactionTimeMs >= fromMs && transactionTimeMs <= toMs;
}

function collectExactCombos(
  candidates: StatementItem[],
  target: number,
  size: number
): StatementItem[][] {
  const combos: StatementItem[][] = [];

  const walk = (startIndex: number, remaining: number, current: StatementItem[]) => {
    if (current.length === size) {
      if (remaining === 0) {
        combos.push([...current]);
      }
      return;
    }

    for (let i = startIndex; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const amount = Math.abs(getSignedAmount(candidate));
      if (amount > remaining) {
        continue;
      }

      current.push(candidate);
      walk(i + 1, remaining - amount, current);
      current.pop();
    }
  };

  walk(0, target, []);
  return combos;
}

function findBestTransactionCombo(
  order: MatchableOrder,
  statement: StatementItem[],
  usedOperationIds: Set<string>,
  usedInBatch: Set<string>,
  usedDefaultAccount: boolean
): StatementItem[] | null {
  const candidates = statement.filter((item) =>
    isEligibleTransaction(item, order, usedOperationIds, usedInBatch, usedDefaultAccount)
  );

  for (let size = 1; size <= MAX_SPLIT_PARTS; size += 1) {
    const exactCombos = collectExactCombos(candidates, order.amountExpectedCents, size);
    if (exactCombos.length === 0) {
      continue;
    }

    const mentioned = exactCombos.filter((combo) =>
      combo.some((item) => transactionMentionsOrder(item, order.id))
    );

    if (mentioned.length === 1) {
      return mentioned[0];
    }
    if (mentioned.length > 1) {
      return null;
    }
    if (exactCombos.length === 1) {
      return exactCombos[0];
    }
    return null;
  }

  return null;
}

export function matchTransactionsToOrders(input: {
  pendingOrders: MatchableOrder[];
  statement: StatementItem[];
  usedOperationIds?: Set<string>;
  usedDefaultAccount: boolean;
}): MatchCandidate[] {
  const usedOperationIds = input.usedOperationIds ?? new Set<string>();
  const usedInBatch = new Set<string>();
  const matches: MatchCandidate[] = [];

  for (const order of input.pendingOrders) {
    const transactions = findBestTransactionCombo(
      order,
      input.statement,
      usedOperationIds,
      usedInBatch,
      input.usedDefaultAccount
    );

    if (!transactions) {
      continue;
    }

    for (const transaction of transactions) {
      usedInBatch.add(transaction.id);
    }
    matches.push({ orderId: order.id, transactions });
  }

  return matches;
}
