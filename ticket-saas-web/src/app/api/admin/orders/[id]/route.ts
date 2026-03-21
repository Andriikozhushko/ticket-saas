import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUSES = ["awaiting_payment", "paid", "expired"] as const;

/** РћРЅРѕРІРёС‚Рё СЃС‚Р°С‚СѓСЃ Р°Р±Рѕ С‡Р°СЃ Р·Р°РјРѕРІР»Рµння (С‚С–Р»ьки РїРѕРІРЅРёР№ Р°РґРјС–РЅ). */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }
  const status = typeof raw.status === "string" && STATUSES.includes(raw.status as (typeof STATUSES)[number])
    ? (raw.status as (typeof STATUSES)[number])
    : undefined;
  let expiresAt: Date | undefined;
  if (raw.expiresAt != null) {
    const parsed = new Date(raw.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
    expiresAt = parsed;
  }
  let createdAt: Date | undefined;
  if (raw.createdAt != null) {
    const parsed = new Date(raw.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid createdAt" }, { status: 400 });
    }
    createdAt = parsed;
  }
  if (status === undefined && expiresAt === undefined && createdAt === undefined) {
    return NextResponse.json({ error: "Provide status, expiresAt or createdAt" }, { status: 400 });
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const data: { status?: string; expiresAt?: Date; createdAt?: Date } = {};
  if (status !== undefined) data.status = status;
  if (expiresAt !== undefined) data.expiresAt = expiresAt;
  if (createdAt !== undefined) data.createdAt = createdAt;
  await prisma.order.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

