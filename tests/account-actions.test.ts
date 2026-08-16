import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const authMock = vi.fn();
const verifyPasswordMock = vi.fn();
const hashPasswordMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));
vi.mock("@/lib/password", () => ({
  MIN_PASSWORD_LENGTH: 6,
  verifyPassword: (...a: unknown[]) => verifyPasswordMock(...a),
  hashPassword: (...a: unknown[]) => hashPasswordMock(...a),
}));

import { changePassword } from "../src/app/(portal)/account/actions";

const initialState = { error: "", success: false };

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  authMock.mockReset();
  verifyPasswordMock.mockReset();
  hashPasswordMock.mockReset();
  hashPasswordMock.mockResolvedValue("new-hash");
});

describe("changePassword", () => {
  it("throws Forbidden when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(
      changePassword(initialState, form({ currentPassword: "a", newPassword: "abcdef", confirmPassword: "abcdef" })),
    ).rejects.toThrow("Forbidden");
  });

  it("rejects a new password shorter than the minimum length", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await changePassword(initialState, form({ currentPassword: "a", newPassword: "abc", confirmPassword: "abc" }));
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/6 ký tự/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await changePassword(
      initialState,
      form({ currentPassword: "a", newPassword: "abcdef", confirmPassword: "different" }),
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/khớp/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({ id: "u1", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(false);
    const res = await changePassword(
      initialState,
      form({ currentPassword: "wrong", newPassword: "abcdef", confirmPassword: "abcdef" }),
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/hiện tại không đúng/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates the password hash when everything is valid", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findUniqueMock.mockResolvedValue({ id: "u1", password: "stored-hash" });
    verifyPasswordMock.mockResolvedValue(true);
    const res = await changePassword(
      initialState,
      form({ currentPassword: "correct", newPassword: "abcdef", confirmPassword: "abcdef" }),
    );
    expect(res.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { password: "new-hash" } });
  });
});
