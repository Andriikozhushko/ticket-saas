import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type DependencyStatus = "ok" | "degraded" | "missing_config";

export async function getDatabaseHealth(): Promise<{ status: DependencyStatus; detail: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", detail: "Database reachable" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    return { status: "degraded", detail };
  }
}

export function getMailHealth(): { status: DependencyStatus; detail: string } {
  if (process.env.BREVO_API_KEY) {
    return { status: "ok", detail: "Brevo API key configured" };
  }
  return {
    status: process.env.NODE_ENV === "production" ? "missing_config" : "degraded",
    detail:
      process.env.NODE_ENV === "production"
        ? "BREVO_API_KEY is missing"
        : "BREVO_API_KEY is missing; dev falls back to logging codes to the server console",
  };
}

export function getCaptchaHealth(): { status: DependencyStatus; detail: string } {
  if (process.env.NODE_ENV !== "production") {
    return { status: "degraded", detail: "Turnstile verification is bypassed in non-production environments" };
  }
  if (process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY) {
    return { status: "ok", detail: "Turnstile keys configured" };
  }
  return { status: "missing_config", detail: "Turnstile keys are missing" };
}

export function getMonobankHealth(): { status: DependencyStatus; detail: string } {
  return {
    status: "degraded",
    detail: "Monobank depends on per-organization configuration and is validated at runtime",
  };
}

export function formatRouteError(error: unknown, fallbackMessage: string): { status: number; message: string } {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, message: "РЎРµСЂРІС–СЃ Р±Р°Р·Рё РґР°РЅРёС… С‚РёРјС‡Р°сово РЅРµРґРѕСЃС‚СѓРїРЅРёР№. РЎРїСЂРѕР±СѓР№С‚Рµ С‰Рµ СЂР°Р·." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { status: 500, message: `${fallbackMessage} Код РїРѕРјРёР»РєРё Prisma: ${error.code}.` };
  }
  if (error instanceof Error) {
    return {
      status: 500,
      message: process.env.NODE_ENV === "development" ? `${fallbackMessage} ${error.message}` : fallbackMessage,
    };
  }
  return { status: 500, message: fallbackMessage };
}

