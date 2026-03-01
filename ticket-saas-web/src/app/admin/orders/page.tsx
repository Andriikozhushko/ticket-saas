import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminOrdersClient, { type OrderRow } from "./admin-orders-client";

export default async function AdminOrdersPage() {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin) redirect("/admin");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, org: { select: { name: true } } } },
      payment: { select: { id: true, amountCents: true, occurredAt: true } },
      tickets: { select: { id: true } },
    },
  });

  const initialOrders: OrderRow[] = orders.map((o) => ({
    id: o.id,
    buyerEmail: o.buyerEmail,
    amountExpectedCents: o.amountExpectedCents,
    quantity: o.quantity,
    status: o.status,
    expiresAt: o.expiresAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    eventId: o.event.id,
    eventTitle: o.event.title,
    orgName: o.event.org.name,
    payment: o.payment
      ? { id: o.payment.id, amountCents: o.payment.amountCents, occurredAt: o.payment.occurredAt.toISOString() }
      : null,
    ticketsCount: o.tickets.length,
  }));

  return <AdminOrdersClient initialOrders={initialOrders} />;
}
