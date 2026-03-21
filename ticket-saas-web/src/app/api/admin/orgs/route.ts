import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  const canCreate = session?.isAdmin || session?.role === "organizer";
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const org = await prisma.organization.create({
      data: { ownerId: session.userId, name },
    });
    if (!session.isAdmin && session.role === "user") {
      await prisma.user.update({ where: { id: session.userId }, data: { role: "organizer" } });
    }

    return NextResponse.json(org);
  } catch {
    return NextResponse.json({ error: "РџРѕРјРёР»РєР° СЃС‚РІРѕСЂРµння РѕСЂРіР°РЅС–Р·Р°С†С–С—" }, { status: 500 });
  }
}

