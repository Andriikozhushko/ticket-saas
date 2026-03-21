import { prisma } from "../lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import HomeClient from "./home.client";

type HomeEventRow = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  isFinished: boolean;
  startsAt: Date | null;
  city: string | null;
  venue: string | null;
  posterUrl: string | null;
  org: { name: string | null } | null;
  _count: { orders: number; ticketTypes: number };
};

export default async function HomePage() {
  noStore();

  let rows: HomeEventRow[];
  try {
    rows = await prisma.event.findMany({
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        title: true,
        priceCents: true,
        currency: true,
        isFinished: true,
        startsAt: true,
        city: true,
        venue: true,
        posterUrl: true,
        org: { select: { name: true } },
        _count: { select: { orders: true, ticketTypes: true } },
      },
    });
  } catch (error) {
    console.error("[home] failed to load events", error);
    rows = [];
  }

  const events = rows.map((e) => ({
    id: e.id,
    title: e.title,
    priceCents: e.priceCents,
    currency: e.currency,
    isFinished: e.isFinished,
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
