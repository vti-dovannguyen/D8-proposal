import { describe, it, expect } from "vitest";
import { DEFAULT_PASSWORD, MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";

describe("password helpers", () => {
  it("exports the default password and minimum length constants", () => {
    expect(DEFAULT_PASSWORD).toBe("Vti@1234");
    expect(MIN_PASSWORD_LENGTH).toBe(6);
  });

  it("hashes a password to something other than the plain value", async () => {
    const hash = await hashPassword("Vti@1234");
    expect(hash).not.toBe("Vti@1234");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("Vti@1234");
    expect(await verifyPassword("Vti@1234", hash)).toBe(true);
  });

  it("rejects an incorrect password against a hash", async () => {
    const hash = await hashPassword("Vti@1234");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash on each call (random salt)", async () => {
    const hashA = await hashPassword("Vti@1234");
    const hashB = await hashPassword("Vti@1234");
    expect(hashA).not.toBe(hashB);
  });
});
