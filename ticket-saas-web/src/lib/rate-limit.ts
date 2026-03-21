/**
 * In-memory rate limits for local app instances.
 * Good enough for dev / single-instance deploys; replace with Redis for multi-instance scaling.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_PER_EMAIL = 3;
const SEND_CODE_COOLDOWN_MS = 60 * 1000;

const ipTimestamps: Map<string, number[]> = new Map();
const emailTimestamps: Map<string, number[]> = new Map();

function prune(map: Map<string, number[]>, windowStart: number) {
  const toDelete: string[] = [];
  map.forEach((arr, key) => {
    const kept = arr.filter((t) => t > windowStart);
    if (kept.length === 0) toDelete.push(key);
    else map.set(key, kept);
  });
  toDelete.forEach((key) => map.delete(key));
}

export function checkLoginRateLimit(ip: string, email: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  prune(ipTimestamps, windowStart);
  prune(emailTimestamps, windowStart);

  const normalizedEmail = email.trim().toLowerCase();
  const ipArr = ipTimestamps.get(ip) ?? [];
  const emailArr = emailTimestamps.get(normalizedEmail) ?? [];
  const lastEmailAttempt = emailArr[emailArr.length - 1];

  if (typeof lastEmailAttempt === "number" && now - lastEmailAttempt < SEND_CODE_COOLDOWN_MS) {
    return { allowed: false, error: "Код уже було надіслано. Зачекайте близько хвилини перед повторною спробою." };
  }
  if (ipArr.length >= MAX_PER_IP) {
    return { allowed: false, error: "Забагато спроб. Спробуйте ще раз через 10 хвилин." };
  }
  if (emailArr.length >= MAX_PER_EMAIL) {
    return { allowed: false, error: "На цей email уже надіслано максимум кодів. Зачекайте 10 хвилин." };
  }

  return { allowed: true };
}

export function recordLoginAttempt(ip: string, email: string): void {
  const now = Date.now();
  const ipArr = ipTimestamps.get(ip) ?? [];
  ipArr.push(now);
  ipTimestamps.set(ip, ipArr);

  const normalizedEmail = email.trim().toLowerCase();
  const emailArr = emailTimestamps.get(normalizedEmail) ?? [];
  emailArr.push(now);
  emailTimestamps.set(normalizedEmail, emailArr);
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_PER_IP = 15;
const verifyIpTimestamps: Map<string, number[]> = new Map();

export function checkVerifyRateLimit(ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const windowStart = now - VERIFY_WINDOW_MS;
  prune(verifyIpTimestamps, windowStart);
  const attempts = verifyIpTimestamps.get(ip) ?? [];

  if (attempts.length >= VERIFY_MAX_PER_IP) {
    return { allowed: false, error: "Забагато спроб перевірки коду. Спробуйте ще раз через 10 хвилин." };
  }

  return { allowed: true };
}

export function recordVerifyAttempt(ip: string): void {
  const now = Date.now();
  const attempts = verifyIpTimestamps.get(ip) ?? [];
  attempts.push(now);
  verifyIpTimestamps.set(ip, attempts);
}

const ORDER_WINDOW_MS = 5 * 60 * 1000;
const ORDER_MAX_PER_IP = 25;
const orderIpTimestamps: Map<string, number[]> = new Map();

export function checkOrderCreateRateLimit(ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const windowStart = now - ORDER_WINDOW_MS;
  prune(orderIpTimestamps, windowStart);
  const attempts = orderIpTimestamps.get(ip) ?? [];

  if (attempts.length >= ORDER_MAX_PER_IP) {
    return { allowed: false, error: "Забагато замовлень. Спробуйте ще раз через 5 хвилин." };
  }

  return { allowed: true };
}

export function recordOrderCreateAttempt(ip: string): void {
  const now = Date.now();
  const attempts = orderIpTimestamps.get(ip) ?? [];
  attempts.push(now);
  orderIpTimestamps.set(ip, attempts);
}
