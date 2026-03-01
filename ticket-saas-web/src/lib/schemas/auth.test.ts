import { describe, it, expect } from "vitest";
import { sendCodeBodySchema, verifyBodySchema } from "./auth";

describe("auth schemas", () => {
  describe("sendCodeBodySchema", () => {
    it("accepts valid email and token", () => {
      const result = sendCodeBodySchema.safeParse({
        email: "user@example.com",
        token: "turnstile-token-123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
        expect(result.data.token).toBe("turnstile-token-123");
      }
    });

    it("rejects invalid email", () => {
      const result = sendCodeBodySchema.safeParse({
        email: "not-an-email",
        token: "x",
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty or missing token (used in dev when captcha is skipped)", () => {
      expect(sendCodeBodySchema.safeParse({ email: "user@example.com", token: "" }).success).toBe(true);
      expect(sendCodeBodySchema.safeParse({ email: "user@example.com" }).success).toBe(true);
    });
  });

  describe("verifyBodySchema", () => {
    it("accepts valid email and code", () => {
      const result = verifyBodySchema.safeParse({
        email: "user@example.com",
        code: "123456",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
        expect(result.data.code).toBe("123456");
      }
    });

    it("rejects empty code", () => {
      const result = verifyBodySchema.safeParse({
        email: "user@example.com",
        code: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = verifyBodySchema.safeParse({
        email: "bad",
        code: "123456",
      });
      expect(result.success).toBe(false);
    });
  });
});
