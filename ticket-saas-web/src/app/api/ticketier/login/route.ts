import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTicketierPassword, createTicketierSession } from "@/lib/auth";

const TICKETIER_SESSION_COOKIE = "ticketier_session_id";
const TICKETIER_SESSION_DAYS = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const login = typeof body?.login === "string" ? body.login.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!login || !password) {
      return NextResponse.json({ error: "Логін і пароль обовʼязкові" }, { status: 400 });
    }
    const ticketier = await prisma.ticketier.findUnique({
      where: { login },
      select: { id: true, passwordHash: true },
    });
    if (!ticketier || !verifyTicketierPassword(password, ticketier.passwordHash)) {
      return NextResponse.json({ error: "Невірний логін або пароль" }, { status: 401 });
    }
    const sessionId = await createTicketierSession(ticketier.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(TICKETIER_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TICKETIER_SESSION_DAYS * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[ticketier/login]", err);
    const message = err instanceof Error ? err.message : "Помилка входу";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Помилка входу" },
      { status: 500 }
    );
  }
}
