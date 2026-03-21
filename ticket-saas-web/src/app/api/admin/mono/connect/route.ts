import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MonoJar = { id: string; sendId: string; title: string; currencyCode: number };
type MonoClientInfo = { jars?: MonoJar[] };

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const orgId = typeof body?.orgId === "string" ? body.orgId : "";
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!orgId || !token) return NextResponse.json({ error: "orgId and token required" }, { status: 400 });

    const org = await prisma.organization.findFirst({
      where: { id: orgId, ownerId: session.userId },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const res = await fetch("https://api.monobank.ua/personal/client-info", {
      headers: { "X-Token": token },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Monobank auth failed", details: text }, { status: 400 });
    }

    const info = (await res.json()) as MonoClientInfo;
    const jars = (info.jars || [])
      .filter((jar) => jar.currencyCode === 980 && Boolean(jar.sendId))
      .map((jar) => ({
        id: jar.id,
        sendId: jar.sendId.startsWith("jar/") ? jar.sendId.slice(4) : jar.sendId,
        title: jar.title,
        currencyCode: jar.currencyCode,
      }));
    const defaultJarId = jars[0]?.id || "0";

    const conn = await prisma.monoConnection.upsert({
      where: { orgId },
      update: { token, accountId: defaultJarId },
      create: { orgId, token, accountId: defaultJarId },
    });

    return NextResponse.json({
      ok: true,
      orgId: conn.orgId,
      defaultJarId: conn.accountId !== "0" ? conn.accountId : null,
      jars: jars.map((jar) => ({ id: jar.id, sendId: jar.sendId, title: jar.title })),
    });
  } catch {
    return NextResponse.json({ error: "РџРѕРјРёР»РєР° РїС–РґРєР»СЋС‡Рµння Monobank" }, { status: 500 });
  }
}

