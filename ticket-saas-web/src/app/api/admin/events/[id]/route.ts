import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseStartsAt(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await context.params;
    const event = await prisma.event.findFirst({
      where: { id },
      include: { org: { select: { id: true, name: true, ownerId: true } }, ticketTypes: { orderBy: { sortOrder: "asc" } } },
    });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!session.isAdmin && event.org.ownerId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id: eventId } = await context.params;
    const body = await req.json();
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { org: true, ticketTypes: true },
    });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!session.isAdmin && event.org.ownerId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (session.isAdmin && body?.approve === true) {
      await prisma.event.update({ where: { id: eventId }, data: { status: "approved" } });
      return NextResponse.json({ ok: true, status: "approved" });
    }

    const title = typeof body?.title === "string" ? body.title.trim() : undefined;
    const startsAt = parseStartsAt(body?.startsAt);
    const venue = typeof body?.venue === "string" ? body.venue.trim() || null : undefined;
    const city = typeof body?.city === "string" ? body.city.trim() || null : undefined;
    const posterUrl = typeof body?.posterUrl === "string" ? body.posterUrl.trim() || null : undefined;
    const organizerPhotoUrl = typeof body?.organizerPhotoUrl === "string" ? body.organizerPhotoUrl.trim() || null : undefined;
    const description = typeof body?.description === "string" ? body.description.trim() || null : undefined;
    const rawTicketTypes = Array.isArray(body?.ticketTypes) ? body.ticketTypes : undefined;
    type TicketTypeRow = { name: string; priceCents: number };
    const mappedTicketTypes: (TicketTypeRow | null)[] | undefined =
      rawTicketTypes?.map((t: unknown): TicketTypeRow | null => {
        if (!t || typeof t !== "object") return null;
        const name = typeof (t as { name?: string }).name === "string" ? (t as { name: string }).name.trim() : "";
        const priceCents = Math.round(Number((t as { priceCents?: number }).priceCents));
        if (!name || !Number.isFinite(priceCents) || priceCents < 0) return null;
        return { name, priceCents };
      });
    const ticketTypes = mappedTicketTypes?.filter((t): t is TicketTypeRow => t !== null);

    const updateData: Parameters<typeof prisma.event.update>[0]["data"] = {};
    if (title !== undefined) updateData.title = title;
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (venue !== undefined) updateData.venue = venue;
    if (city !== undefined) updateData.city = city;
    if (posterUrl !== undefined) updateData.posterUrl = posterUrl;
    if (organizerPhotoUrl !== undefined) updateData.organizerPhotoUrl = organizerPhotoUrl;
    if (description !== undefined) updateData.description = description;

    if (ticketTypes && ticketTypes.length > 0) {
      updateData.priceCents = Math.min(...ticketTypes.map((t: { name: string; priceCents: number }) => t.priceCents));
      await prisma.ticketType.deleteMany({ where: { eventId } });
      await prisma.ticketType.createMany({
        data: ticketTypes.map((t: { name: string; priceCents: number }, i: number) => ({
          eventId,
          name: t.name,
          priceCents: t.priceCents,
          sortOrder: i,
        })),
      });
    }
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
      include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Помилка оновлення" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id: eventId } = await context.params;
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { org: true },
    });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!session.isAdmin && event.org.ownerId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const orderIds = await prisma.order.findMany({ where: { eventId }, select: { id: true } }).then((o) => o.map((x) => x.id));
    const db = prisma as unknown as {
      ticketierEvent?: { deleteMany: (p: { where: { eventId: string } }) => Promise<unknown> };
      orderPaymentPart?: { deleteMany: (p: { where: { orderId: { in: string[] } } }) => Promise<unknown> };
    };
    const tx = [
      prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
      ...(db.orderPaymentPart ? [db.orderPaymentPart.deleteMany({ where: { orderId: { in: orderIds } } })] : []),
      prisma.ticket.deleteMany({ where: { orderId: { in: orderIds } } }),
      prisma.order.deleteMany({ where: { eventId } }),
      ...(db.ticketierEvent ? [db.ticketierEvent.deleteMany({ where: { eventId } })] : []),
      prisma.event.delete({ where: { id: eventId } }),
    ] as unknown as Parameters<typeof prisma.$transaction>[0];
    await prisma.$transaction(tx);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Помилка видалення" }, { status: 500 });
  }
}
