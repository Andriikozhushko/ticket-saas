import { describe, it, expect } from "vitest";
import { hashTicketierPassword, verifyTicketierPassword } from "./auth";

describe("auth (ticketier password)", () => {
  it("hashTicketierPassword returns hex string of expected length", () => {
    const hash = hashTicketierPassword("test-password");
    expect(hash).toMatch(/^[a-f0-9]+$/);
    expect(hash.length).toBe(128); // 64 bytes = 128 hex chars
  });

  it("verifyTicketierPassword returns true for correct password", () => {
    const password = "secret123";
    const hash = hashTicketierPassword(password);
    expect(verifyTicketierPassword(password, hash)).toBe(true);
  });

  it("verifyTicketierPassword returns false for wrong password", () => {
    const hash = hashTicketierPassword("correct");
    expect(verifyTicketierPassword("wrong", hash)).toBe(false);
  });

  it("same password produces same hash (deterministic)", () => {
    const a = hashTicketierPassword("same");
    const b = hashTicketierPassword("same");
    expect(a).toBe(b);
  });
});
