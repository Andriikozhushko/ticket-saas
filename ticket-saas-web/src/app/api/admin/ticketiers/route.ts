import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashTicketierPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  const canCreate = session?.isAdmin || session?.role === "organizer";
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const orgId = typeof body?.orgId === "string" ? body.orgId.trim() : "";
    const login = typeof body?.login === "string" ? body.login.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() || null : null;
    if (!orgId || !login || !password) {
      return NextResponse.json({ error: "orgId, login, password required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль мінімум 6 символів" }, { status: 400 });
    }
    const org = await prisma.organization.findFirst({
      where: { id: orgId, ...(session.isAdmin ? {} : { ownerId: session.userId }) },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const existing = await (prisma as unknown as { ticketier: { findUnique: (p: { where: { login: string } }) => Promise<unknown> } }).ticketier.findUnique({
      where: { login },
    });
    if (existing) return NextResponse.json({ error: "Такий логін вже зайнятий" }, { status: 400 });

    const ticketier = await (prisma as unknown as {
      ticketier: { create: (p: { data: { orgId: string; login: string; passwordHash: string; displayName: string | null; createdById: string } }) => Promise<{ id: string; login: string }> };
    }).ticketier.create({
      data: {
        orgId,
        login,
        passwordHash: hashTicketierPassword(password),
        displayName,
        createdById: session.userId,
      },
    });
    return NextResponse.json({ id: ticketier.id, login: ticketier.login });
  } catch (e) {
    return NextResponse.json({ error: "Помилка створення білетника" }, { status: 500 });
  }
}
