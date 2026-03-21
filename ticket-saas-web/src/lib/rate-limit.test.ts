import { describe, expect, it, vi } from "vitest";
import {
  checkLoginRateLimit,
  checkOrderCreateRateLimit,
  checkVerifyRateLimit,
  recordLoginAttempt,
  recordOrderCreateAttempt,
  recordVerifyAttempt,
} from "./rate-limit";

describe("rate-limit", () => {
  it("blocks send-code retries during cooldown", () => {
    vi.useFakeTimers();

    const ip = "127.0.0.1";
    const email = "user@example.com";
    expect(checkLoginRateLimit(ip, email).allowed).toBe(true);

    recordLoginAttempt(ip, email);

    const secondAttempt = checkLoginRateLimit(ip, email);
    expect(secondAttempt.allowed).toBe(false);
    expect(secondAttempt.error).toContain("хвилини");

    vi.useRealTimers();
  });

  it("limits verify attempts per ip", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 15; i += 1) {
      recordVerifyAttempt(ip);
    }

    expect(checkVerifyRateLimit(ip).allowed).toBe(false);
  });

  it("limits order creation per ip", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 25; i += 1) {
      recordOrderCreateAttempt(ip);
    }

    expect(checkOrderCreateRateLimit(ip).allowed).toBe(false);
  });
});
