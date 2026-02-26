/**
 * In-memory rate limit for login/send-code.
 * Max 5 requests per IP per 10 min, max 3 codes per email per 10 min.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_PER_IP = 5;
const MAX_PER_EMAIL = 3;

const ipTimestamps: Map<string, number[]> = new Map();
const emailTimestamps: Map<string, number[]> = new Map();

function prune(map: Map<string, number[]>, windowEnd: number) {
  const toDelete: string[] = [];
  map.forEach((arr, key) => {
    const kept = arr.filter((t) => t > windowEnd);
    if (kept.length === 0) toDelete.push(key);
    else map.set(key, kept);
  });
  toDelete.forEach((k) => map.delete(k));
}

export function checkLoginRateLimit(ip: string, email: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const windowEnd = now - WINDOW_MS;
  prune(ipTimestamps, windowEnd);
  prune(emailTimestamps, windowEnd);

  const ipArr = ipTimestamps.get(ip) ?? [];
  const emailArr = emailTimestamps.get(email.toLowerCase()) ?? [];

  if (ipArr.length >= MAX_PER_IP) {
    return { allowed: false, error: "Забагато спроб. Спробуйте через 10 хвилин." };
  }
  if (emailArr.length >= MAX_PER_EMAIL) {
    return { allowed: false, error: "На цей email вже надіслано максимум кодів. Зачекайте 10 хвилин." };
  }
  return { allowed: true };
}

export function recordLoginAttempt(ip: string, email: string): void {
  const now = Date.now();
  const ipArr = ipTimestamps.get(ip) ?? [];
  ipArr.push(now);
  ipTimestamps.set(ip, ipArr);

  const key = email.trim().toLowerCase();
  const emailArr = emailTimestamps.get(key) ?? [];
  emailArr.push(now);
  emailTimestamps.set(key, emailArr);
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

// ——— Verify code (IP only): max 15 per 10 min ———
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_PER_IP = 15;
const verifyIpTimestamps: Map<string, number[]> = new Map();

export function checkVerifyRateLimit(ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const windowEnd = now - VERIFY_WINDOW_MS;
  prune(verifyIpTimestamps, windowEnd);
  const arr = verifyIpTimestamps.get(ip) ?? [];
  if (arr.length >= VERIFY_MAX_PER_IP) {
    return { allowed: false, error: "Забагато спроб перевірки коду. Спробуйте через 10 хвилин." };
  }
  return { allowed: true };
}

export function recordVerifyAttempt(ip: string): void {
  const now = Date.now();
  const arr = verifyIpTimestamps.get(ip) ?? [];
  arr.push(now);
  verifyIpTimestamps.set(ip, arr);
}

// ——— Order create (IP only): max 25 per 5 min ———
const ORDER_WINDOW_MS = 5 * 60 * 1000;
const ORDER_MAX_PER_IP = 25;
const orderIpTimestamps: Map<string, number[]> = new Map();

export function checkOrderCreateRateLimit(ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const windowEnd = now - ORDER_WINDOW_MS;
  const toDelete: string[] = [];
  orderIpTimestamps.forEach((arr, key) => {
    const kept = arr.filter((t) => t > windowEnd);
    if (kept.length === 0) toDelete.push(key);
    else orderIpTimestamps.set(key, kept);
  });
  toDelete.forEach((k) => orderIpTimestamps.delete(k));
  const arr = orderIpTimestamps.get(ip) ?? [];
  if (arr.length >= ORDER_MAX_PER_IP) {
    return { allowed: false, error: "Забагато замовлень. Спробуйте через 5 хвилин." };
  }
  return { allowed: true };
}

export function recordOrderCreateAttempt(ip: string): void {
  const now = Date.now();
  const arr = orderIpTimestamps.get(ip) ?? [];
  arr.push(now);
  orderIpTimestamps.set(ip, arr);
}
