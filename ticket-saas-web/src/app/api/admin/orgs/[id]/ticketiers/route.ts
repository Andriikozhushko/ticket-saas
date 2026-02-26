import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: orgId } = await context.params;
  const org = await prisma.organization.findFirst({
    where: { id: orgId, ...(session.isAdmin ? {} : { ownerId: session.userId }) },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type TicketierWithEvents = { id: string; login: string; displayName: string | null; events: { eventId: string }[] };
  const ticketiers = await (prisma as unknown as { ticketier: { findMany: (args: { where: { orgId: string }; include: { events: { select: { eventId: true } } } }) => Promise<TicketierWithEvents[]> } }).ticketier.findMany({
    where: { orgId },
    include: { events: { select: { eventId: true } } },
  });
  return NextResponse.json(ticketiers.map((t) => ({
    id: t.id,
    login: t.login,
    displayName: t.displayName,
    eventIds: t.events.map((e) => e.eventId),
  })));
}
