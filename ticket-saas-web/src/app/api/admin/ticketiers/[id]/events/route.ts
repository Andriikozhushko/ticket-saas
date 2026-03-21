import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id: ticketierId } = await context.params;
    const body = await req.json();
    const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const ticketier = await (prisma as unknown as {
      ticketier: { findFirst: (p: { where: { id: string }; include: { org: true } }) => Promise<{ id: string; orgId: string; org: { ownerId: string } } | null> };
    }).ticketier.findFirst({
      where: { id: ticketierId },
      include: { org: true },
    });
    if (!ticketier) return NextResponse.json({ error: "Ticketier not found" }, { status: 404 });
    if (!session.isAdmin && ticketier.org.ownerId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { org: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (event.orgId !== ticketier.orgId) return NextResponse.json({ error: "Event not in same org" }, { status: 400 });
    if (!session.isAdmin && event.org.ownerId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await (prisma as unknown as {
      ticketierEvent: { create: (p: { data: { ticketierId: string; eventId: string } }) => Promise<unknown> };
    }).ticketierEvent.create({
      data: { ticketierId, eventId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Помилка" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id: ticketierId } = await context.params;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const ticketier = await (prisma as unknown as {
      ticketier: { findFirst: (p: { where: { id: string }; include: { org: true } }) => Promise<{ org: { ownerId: string } } | null> };
    }).ticketier.findFirst({
      where: { id: ticketierId },
      include: { org: true },
    });
    if (!ticketier) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!session.isAdmin && ticketier.org.ownerId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await (prisma as unknown as {
      ticketierEvent: { deleteMany: (p: { where: { ticketierId: string; eventId: string } }) => Promise<unknown> };
    }).ticketierEvent.deleteMany({
      where: { ticketierId, eventId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Помилка" }, { status: 500 });
  }
}
