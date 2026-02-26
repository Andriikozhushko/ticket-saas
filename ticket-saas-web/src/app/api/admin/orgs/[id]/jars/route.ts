import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MonoJar = { id: string; sendId: string; title: string; currencyCode: number };
type MonoClientInfo = { jars?: MonoJar[] };

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id: orgId } = await context.params;
    const org = await prisma.organization.findFirst({
      where: { id: orgId, ownerId: session.userId },
      include: { mono: true },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const mono = org.mono;
    if (!mono?.token) return NextResponse.json({ jars: [] });

    const res = await fetch("https://api.monobank.ua/personal/client-info", {
      headers: { "X-Token": mono.token },
    });
    if (!res.ok) return NextResponse.json({ jars: [] });
    const info = (await res.json()) as MonoClientInfo;
    const jars = (info.jars || [])
      .filter((j) => j.currencyCode === 980 && !!j.sendId)
      .map((j) => ({
        id: j.id,
        sendId: j.sendId.startsWith("jar/") ? j.sendId.slice(4) : j.sendId,
        title: j.title,
      }));
    return NextResponse.json({ jars });
  } catch {
    return NextResponse.json({ jars: [] });
  }
}
