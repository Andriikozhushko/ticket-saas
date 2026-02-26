import { prisma } from "../lib/prisma";
import HomeClient from "./home.client";

export default async function HomePage() {
  const rows = await prisma.event.findMany({
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      priceCents: true,
      currency: true,
      startsAt: true,
      city: true,
      venue: true,
      posterUrl: true,
      org: { select: { name: true } },
      _count: { select: { orders: true, ticketTypes: true } },
    },
  });

  const events = rows.map((e) => ({
    id: e.id,
    title: e.title,
    priceCents: e.priceCents,
    currency: e.currency,
    startsAt: e.startsAt?.toISOString() ?? null,
    city: e.city,
    venue: e.venue,
    posterUrl: e.posterUrl,
    orgName: e.org?.name ?? null,
    ordersCount: e._count.orders,
    ticketTypesCount: e._count.ticketTypes,
  }));

  return <HomeClient events={events} />;
}
