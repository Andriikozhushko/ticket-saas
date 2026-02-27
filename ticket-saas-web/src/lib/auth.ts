import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";

const SESSION_COOKIE = "session_id";
const TICKETIER_SESSION_COOKIE = "ticketier_session_id";
const SESSION_DAYS = 7;
const TICKETIER_SESSION_DAYS = 30;
const CODE_LENGTH = 6;
const PASSWORD_SALT = process.env.TICKETIER_PASSWORD_SALT ?? "ticketier-v1";
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_KEYLEN = 64;
const CODE_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 3;

/** Admin email from env; single source of truth. Empty = no super-admin. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

export async function createAuthCode(email: string): Promise<string> {
  const code = Array.from(crypto.randomFillSync(new Uint8Array(CODE_LENGTH)))
    .map((n) => (n % 10).toString())
    .join("");
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  await prisma.authCode.create({
    data: { email: email.trim().toLowerCase(), codeHash, expiresAt },
  });
  return code;
}

export async function verifyAuthCode(
  email: string,
  code: string
): Promise<{ ok: true; userId: string; isAdmin: boolean } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await prisma.authCode.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "Код не знайдено або минув" };
  if (record.expiresAt < new Date()) return { ok: false, error: "Код минув" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Вичерпано 3 спроби. Запитайте новий код." };

  const codeHash = hashCode(code);
  if (record.codeHash.length !== codeHash.length) return { ok: false, error: "Невірний код" };
  const match = crypto.timingSafeEqual(Buffer.from(record.codeHash, "hex"), Buffer.from(codeHash, "hex"));
  await prisma.authCode.update({ where: { id: record.id }, data: { attempts: record.attempts + 1 } });
  if (!match) return { ok: false, error: "Невірний код" };

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: "email_code_auth",
        role: normalizedEmail === ADMIN_EMAIL ? "admin" : "user",
      },
    });
  } else if (normalizedEmail === ADMIN_EMAIL && user.role !== "admin") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    user = { ...user, role: "admin" };
  }
  return { ok: true, userId: user.id, isAdmin: user.role === "admin" };
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  return session.id;
}

export type UserRole = "admin" | "organizer" | "user";

export async function getSessionFromCookie(): Promise<{ userId: string; email: string; isAdmin: boolean; role: UserRole } | null> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    const emailLower = session.user.email.trim().toLowerCase();
    const isAdminEmail = ADMIN_EMAIL && emailLower === ADMIN_EMAIL;
    const effectiveRole: UserRole =
      isAdminEmail ? "admin" : (session.user.role === "admin" || session.user.role === "organizer" ? session.user.role : "user") as UserRole;
    if (isAdminEmail && session.user.role !== "admin") {
      await prisma.user.update({ where: { id: session.user.id }, data: { role: "admin" } });
    }
    return { userId: session.user.id, email: session.user.email, isAdmin: effectiveRole === "admin", role: effectiveRole };
  } catch {
    // DB unreachable (e.g. local dev without DB) — treat as no session so layout still renders
    return null;
  }
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function revokeSessionAndClearCookie(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) await prisma.session.updateMany({ where: { id: sid }, data: { revokedAt: new Date() } });
  store.delete(SESSION_COOKIE);
}

// ——— Ticketier (login + password) ———
export function hashTicketierPassword(password: string): string {
  return crypto.pbkdf2Sync(password, PASSWORD_SALT, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, "sha256").toString("hex");
}

export function verifyTicketierPassword(password: string, hash: string): boolean {
  const got = crypto.pbkdf2Sync(password, PASSWORD_SALT, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(got, "hex"));
}

export async function createTicketierSession(ticketierId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + TICKETIER_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await (prisma as unknown as { ticketierSession: { create: (p: { data: { ticketierId: string; expiresAt: Date } }) => Promise<{ id: string }> } }).ticketierSession.create({ data: { ticketierId, expiresAt } });
  return session.id;
}

export async function getTicketierSessionFromCookie(): Promise<{ ticketierId: string; login: string } | null> {
  const store = await cookies();
  const sid = store.get(TICKETIER_SESSION_COOKIE)?.value;
  if (!sid) return null;
  const session = await (prisma as unknown as {
    ticketierSession: { findUnique: (p: { where: { id: string }; include: { ticketier: { select: { id: true; login: true } } } }) => Promise<{ expiresAt: Date; ticketier: { id: string; login: string } } | null> };
  }).ticketierSession.findUnique({
    where: { id: sid },
    include: { ticketier: { select: { id: true, login: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { ticketierId: session.ticketier.id, login: session.ticketier.login };
}

export async function setTicketierSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(TICKETIER_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TICKETIER_SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function revokeTicketierSessionAndClearCookie(): Promise<void> {
  const store = await cookies();
  const sid = store.get(TICKETIER_SESSION_COOKIE)?.value;
  if (sid) await (prisma as unknown as { ticketierSession: { deleteMany: (p: { where: { id: string } }) => Promise<unknown> } }).ticketierSession.deleteMany({ where: { id: sid } });
  store.delete(TICKETIER_SESSION_COOKIE);
}

