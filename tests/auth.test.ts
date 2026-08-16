import { vi } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const verifyPasswordMock = vi.fn();
const hashPasswordMock = vi.fn();

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  DEFAULT_PASSWORD: "Vti@1234",
  verifyPassword: (...a: unknown[]) => verifyPasswordMock(...a),
  hashPassword: (...a: unknown[]) => hashPasswordMock(...a),
}));

import { describe, it, expect, beforeEach } from "vitest";
import { isAllowedEmail, authorizeCredentials, backfillPasswordForNewUser } from "@/lib/auth";

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  verifyPasswordMock.mockReset();
  hashPasswordMock.mockReset();
  hashPasswordMock.mockResolvedValue("hashed-default");
});

describe("isAllowedEmail()", () => {
  it("allows the company domain", () => {
    expect(isAllowedEmail("phap.ledai@vti.com.vn", "vti.com.vn")).toBe(true);
  });
  it("rejects other domains", () => {
    expect(isAllowedEmail("someone@gmail.com", "vti.com.vn")).toBe(false);
  });
  it("rejects empty / malformed", () => {
    expect(isAllowedEmail("", "vti.com.vn")).toBe(false);
    expect(isAllowedEmail("nodomain", "vti.com.vn")).toBe(false);
  });
  it("is case-insensitive on domain", () => {
    expect(isAllowedEmail("Phap.LeDai@VTI.com.vn", "vti.com.vn")).toBe(true);
  });
});

describe("authorizeCredentials()", () => {
  it("returns null when email or password is missing", async () => {
    expect(await authorizeCredentials(undefined, "pw")).toBeNull();
    expect(await authorizeCredentials("a@vti.com.vn", undefined)).toBeNull();
    expect(await authorizeCredentials("", "")).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null for a non-string email or password", async () => {
    expect(await authorizeCredentials(123, "pw")).toBeNull();
    expect(await authorizeCredentials("a@vti.com.vn", 123)).toBeNull();
  });

  it("returns null when the email is outside the allowed domain", async () => {
    const result = await authorizeCredentials("someone@gmail.com", "pw");
    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null when no user exists for the email", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await authorizeCredentials("nobody@vti.com.vn", "pw");
    expect(result).toBeNull();
  });

  it("returns null when the user has no password set", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "MEMBER", password: null });
    const result = await authorizeCredentials("u1@vti.com.vn", "pw");
    expect(result).toBeNull();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("returns null when the password does not match", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "MEMBER", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(false);
    const result = await authorizeCredentials("u1@vti.com.vn", "wrong");
    expect(result).toBeNull();
  });

  it("returns the user when the password matches", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "PM", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(true);
    const result = await authorizeCredentials("u1@vti.com.vn", "correct");
    expect(result).toEqual({ id: "u1", email: "u1@vti.com.vn", name: "U1", role: "PM" });
  });
});

describe("backfillPasswordForNewUser()", () => {
  it("hashes the default password and updates the user", async () => {
    await backfillPasswordForNewUser("u2");
    expect(hashPasswordMock).toHaveBeenCalledWith("Vti@1234");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "u2" }, data: { password: "hashed-default" } });
  });
});
