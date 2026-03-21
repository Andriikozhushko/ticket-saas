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
const AUTH_CODE_RETENTION_DAYS = 2;
const SESSION_RETENTION_DAYS = 30;

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function cleanupAuthArtifacts(email?: string): Promise<void> {
  const now = new Date();
  const authCodeCutoff = new Date(now.getTime() - AUTH_CODE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.authCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { createdAt: { lt: authCodeCutoff } },
          ...(email ? [{ email: normalizeEmail(email) }] : []),
        ],
      },
    }),
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { not: null }, createdAt: { lt: sessionCutoff } },
        ],
      },
    }),
  ]);
}

export async function createAuthCode(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  const code = Array.from(crypto.randomFillSync(new Uint8Array(CODE_LENGTH)))
    .map((value) => (value % 10).toString())
    .join("");
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await cleanupAuthArtifacts(normalizedEmail);
  await prisma.authCode.create({
    data: { email: normalizedEmail, codeHash, expiresAt },
  });

  return code;
}

export async function verifyAuthCode(
  email: string,
  code: string
): Promise<{ ok: true; userId: string; isAdmin: boolean } | { ok: false; error: string }> {
  const normalizedEmail = normalizeEmail(email);
  await cleanupAuthArtifacts();

  const record = await prisma.authCode.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, error: "Код РЅРµ Р·РЅР°Р№РґРµРЅРѕ Р°Р±Рѕ РІС–РЅ СѓР¶Рµ РЅРµРґС–Р№СЃРЅРёР№." };
  }
  if (record.expiresAt < new Date()) {
    return { ok: false, error: "Код СѓР¶Рµ РїСЂРѕСЃС‚СЂРѕС‡РµРЅРёР№. Р—Р°РїСЂРѕСЃС–С‚ь РЅРѕРІРёР№." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Р’РёС‡РµСЂРїР°РЅРѕ 3 СЃРїСЂРѕР±Рё. Р—Р°РїСЂРѕСЃС–С‚ь РЅРѕРІРёР№ РєРѕРґ." };
  }

  const codeHash = hashCode(code);
  if (record.codeHash.length !== codeHash.length) {
    return { ok: false, error: "РќРµРІС–СЂРЅРёР№ РєРѕРґ." };
  }

  const match = crypto.timingSafeEqual(
    Buffer.from(record.codeHash, "hex"),
    Buffer.from(codeHash, "hex")
  );

  if (!match) {
    await prisma.authCode.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });
    return { ok: false, error: "РќРµРІС–СЂРЅРёР№ РєРѕРґ." };
  }

  await prisma.authCode.deleteMany({ where: { email: normalizedEmail } });

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

export async function getSessionFromCookie(): Promise<{
  userId: string;
  email: string;
  isAdmin: boolean;
  role: UserRole;
} | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  const emailLower = normalizeEmail(session.user.email);
  const isAdminEmail = Boolean(ADMIN_EMAIL) && emailLower === ADMIN_EMAIL;
  const effectiveRole: UserRole = isAdminEmail
    ? "admin"
    : session.user.role === "admin" || session.user.role === "organizer"
      ? session.user.role
      : "user";

  if (isAdminEmail && session.user.role !== "admin") {
    await prisma.user.update({ where: { id: session.user.id }, data: { role: "admin" } });
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    isAdmin: effectiveRole === "admin",
    role: effectiveRole,
  };
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
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await prisma.session.updateMany({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }
  store.delete(SESSION_COOKIE);
}

export function hashTicketierPassword(password: string): string {
  return crypto
    .pbkdf2Sync(password, PASSWORD_SALT, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, "sha256")
    .toString("hex");
}

export function verifyTicketierPassword(password: string, hash: string): boolean {
  const calculated = crypto
    .pbkdf2Sync(password, PASSWORD_SALT, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, "sha256")
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(calculated, "hex"));
}

export async function createTicketierSession(ticketierId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + TICKETIER_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await (prisma as unknown as {
    ticketierSession: {
      create: (args: { data: { ticketierId: string; expiresAt: Date } }) => Promise<{ id: string }>;
    };
  }).ticketierSession.create({ data: { ticketierId, expiresAt } });
  return session.id;
}

export async function getTicketierSessionFromCookie(): Promise<{ ticketierId: string; login: string } | null> {
  const store = await cookies();
  const sessionId = store.get(TICKETIER_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  const session = await (prisma as unknown as {
    ticketierSession: {
      findUnique: (args: {
        where: { id: string };
        include: { ticketier: { select: { id: true; login: true } } };
      }) => Promise<{ expiresAt: Date; ticketier: { id: string; login: string } } | null>;
    };
  }).ticketierSession.findUnique({
    where: { id: sessionId },
    include: { ticketier: { select: { id: true, login: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

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
  const sessionId = store.get(TICKETIER_SESSION_COOKIE)?.value;
  if (sessionId) {
    await (prisma as unknown as {
      ticketierSession: {
        deleteMany: (args: { where: { id: string } }) => Promise<unknown>;
      };
    }).ticketierSession.deleteMany({ where: { id: sessionId } });
  }
  store.delete(TICKETIER_SESSION_COOKIE);
}

