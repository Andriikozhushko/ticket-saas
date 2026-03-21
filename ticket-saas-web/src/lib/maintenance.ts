import { prisma } from "@/lib/prisma";
import { expireAwaitingPaymentOrders } from "@/lib/payments";

const AUTH_CODE_RETENTION_DAYS = 2;
const SESSION_RETENTION_DAYS = 30;

export type MaintenanceSummary = {
  expiredOrders: number;
  authCodesDeleted: number;
  sessionsDeleted: number;
  ticketierSessionsDeleted: number;
};

export async function runMaintenance(now = new Date()): Promise<MaintenanceSummary> {
  const authCodeCutoff = new Date(now.getTime() - AUTH_CODE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const expiredOrders = await expireAwaitingPaymentOrders(now);
  const cleanupResult = await prisma.$transaction(async (tx) => {
    const authCodesDeleted = await tx.authCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { createdAt: { lt: authCodeCutoff } },
        ],
      },
    });
    const sessionsDeleted = await tx.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { not: null }, createdAt: { lt: sessionCutoff } },
        ],
      },
    });
    const ticketierSessionsDeleted = await (tx as unknown as {
      ticketierSession: {
        deleteMany: (args: {
          where: {
            OR: Array<
              | { expiresAt: { lt: Date } }
              | { createdAt: { lt: Date } }
            >;
          };
        }) => Promise<{ count: number }>;
      };
    }).ticketierSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { createdAt: { lt: sessionCutoff } },
        ],
      },
    });

    return { authCodesDeleted, sessionsDeleted, ticketierSessionsDeleted };
  });

  return {
    expiredOrders,
    authCodesDeleted: cleanupResult.authCodesDeleted.count,
    sessionsDeleted: cleanupResult.sessionsDeleted.count,
    ticketierSessionsDeleted: cleanupResult.ticketierSessionsDeleted.count,
  };
}
