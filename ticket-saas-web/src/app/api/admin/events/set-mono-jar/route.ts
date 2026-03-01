import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const eventId = typeof body?.eventId === "string" ? body.eventId : "";
    const jarId = typeof body?.jarId === "string" ? body.jarId : "";
    const sendId = typeof body?.sendId === "string" ? body.sendId.trim() || null : null;
    const jarTitle = typeof body?.jarTitle === "string" ? body.jarTitle.trim() || null : null;
    if (!eventId || !jarId) return NextResponse.json({ error: "eventId and jarId required" }, { status: 400 });
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { org: true },
    });
    if (!event || (!session.isAdmin && event.org.ownerId !== session.userId)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    await prisma.event.update({
      where: { id: eventId },
      data: { monoAccountId: jarId, monoJarId: sendId, monoJarTitle: jarTitle },
    });
    return NextResponse.json({ ok: true, eventId, monoAccountId: jarId });
  } catch (e) {
    return NextResponse.json({ error: "Помилка прив'язки банки" }, { status: 500 });
  }
}
