import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TicketTypeInput = { name: string; priceCents: number };

function parseStartsAt(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  const canCreate = session?.isAdmin || session?.role === "organizer";
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const orgId = typeof body?.orgId === "string" ? body.orgId : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const rawTicketTypes = Array.isArray(body?.ticketTypes) ? body.ticketTypes : [];
    const mappedTicketTypes: (TicketTypeInput | null)[] = rawTicketTypes.map((t: unknown): TicketTypeInput | null => {
      if (!t || typeof t !== "object") return null;
      const name = typeof (t as { name?: string }).name === "string" ? (t as { name: string }).name.trim() : "";
      const priceCents = Math.round(Number((t as { priceCents?: number }).priceCents));
      if (!name || !Number.isFinite(priceCents) || priceCents < 0) return null;
      return { name, priceCents };
    });
    const ticketTypes: TicketTypeInput[] = mappedTicketTypes.filter((t): t is TicketTypeInput => t !== null);
    if (!orgId || !title) return NextResponse.json({ error: "orgId, title required" }, { status: 400 });
    if (ticketTypes.length === 0) return NextResponse.json({ error: "Р”РѕРґР°Р№С‚Рµ С…РѕС‡Р° Р± РѕРґРёРЅ РІРёРґ РєРІРёС‚РєР°" }, { status: 400 });
    const jarId = typeof body?.jarId === "string" ? body.jarId.trim() : "";
    const sendId = typeof body?.sendId === "string" ? body.sendId.trim() : "";
    if (!jarId || !sendId) return NextResponse.json({ error: "РћР±РµСЂС–С‚ь Р±Р°нку (Monobank) РґР»я РїСЂРёР№ому РѕРїР»Р°С‚" }, { status: 400 });
    const org = await prisma.organization.findFirst({
      where: { id: orgId, ownerId: session.userId },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const startsAt = parseStartsAt(body?.startsAt);
    const venue = typeof body?.venue === "string" ? body.venue.trim() || null : null;
    const city = typeof body?.city === "string" ? body.city.trim() || null : null;
    const description = typeof body?.description === "string" ? body.description.trim() || null : null;
    const priceCents = Math.min(...ticketTypes.map((t) => t.priceCents));
    const event = await prisma.event.create({
      data: {
        orgId,
        title,
        priceCents,
        currency: "UAH",
        startsAt: startsAt ?? undefined,
        venue,
        city,
        description,
        monoAccountId: jarId,
        monoJarId: sendId,
        ticketTypes: {
          create: ticketTypes.map((t, i) => ({ name: t.name, priceCents: t.priceCents, sortOrder: i })),
        },
      },
      include: { ticketTypes: true },
    });
    return NextResponse.json(event);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/admin/events]", e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "РџРѕРјРёР»РєР° СЃС‚РІРѕСЂРµння РїРѕРґС–С—" },
      { status: 500 }
    );
  }
}

