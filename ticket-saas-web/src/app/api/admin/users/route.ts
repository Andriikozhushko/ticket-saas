import { NextResponse } from "next/server";
import { getSessionFromCookie, ADMIN_EMAIL } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserBodySchema } from "@/lib/schemas/admin-users";

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin || session.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin || session.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = createUserBodySchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Невірні дані";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { email, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role } });
    return NextResponse.json({ ok: true, userId: existing.id, created: false });
  }
  const user = await prisma.user.create({
    data: { email, role, passwordHash: "email_code_auth" },
  });
  return NextResponse.json({ ok: true, userId: user.id, created: true });
}
