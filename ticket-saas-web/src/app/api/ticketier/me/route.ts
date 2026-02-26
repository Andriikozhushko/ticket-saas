import { NextResponse } from "next/server";
import { getTicketierSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getTicketierSessionFromCookie();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ticketier = await (prisma as unknown as {
    ticketier: { findUnique: (p: {
      where: { id: string };
      include: { events: { include: { event: { select: { id: true; title: true } } } } };
    }) => Promise<{ id: string; login: string; displayName: string | null; events: { event: { id: string; title: string } }[] } | null> };
  }).ticketier.findUnique({
    where: { id: session.ticketierId },
    include: {
      events: { include: { event: { select: { id: true, title: true } } } },
    },
  });
  if (!ticketier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const events = ticketier.events.map((e) => ({ id: e.event.id, title: e.event.title }));
  return NextResponse.json({ login: ticketier.login, displayName: ticketier.displayName, events });
}
