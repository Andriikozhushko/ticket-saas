import { NextResponse } from "next/server";
import { getSessionFromCookie, ADMIN_EMAIL } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin || session.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: userId } = await context.params;
  const body = await req.json();
  const role = typeof body?.role === "string" ? body.role : "";
  if (!["user", "organizer", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.email === ADMIN_EMAIL && role !== "admin") {
    return NextResponse.json({ error: "Cannot demote main admin" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: userId }, data: { role } });
  return NextResponse.json({ ok: true, role });
}
