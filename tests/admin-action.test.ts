import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn();
const upsertMock = vi.fn();
const findUniqueMock = vi.fn();
const authMock = vi.fn();
let sheetRows: Record<string, unknown>[] = [];

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/db", () => ({ db: { user: {
  update: (...a: unknown[]) => updateMock(...a),
  upsert: (...a: unknown[]) => upsertMock(...a),
  findUnique: (...a: unknown[]) => findUniqueMock(...a),
} } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("xlsx", () => ({
  read: () => ({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } }),
  utils: { sheet_to_json: () => sheetRows },
}));
const hashPasswordMock = vi.fn();
vi.mock("@/lib/password", () => ({
  DEFAULT_PASSWORD: "Vti@1234",
  hashPassword: (...a: unknown[]) => hashPasswordMock(...a),
}));
// can() is pure — do NOT mock it; use the real implementation.

import { updateUserRole, importUsers, resetUserPassword } from "../src/app/(portal)/admin/actions";

beforeEach(() => {
  updateMock.mockReset();
  upsertMock.mockReset();
  findUniqueMock.mockReset();
  authMock.mockReset();
  sheetRows = [];
  upsertMock.mockResolvedValue({ id: "x" });
  hashPasswordMock.mockReset();
  hashPasswordMock.mockResolvedValue("hashed-default");
});

function xlsxForm() {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array([1, 2, 3])], "users.xlsx"));
  return fd;
}

describe("updateUserRole authorization", () => {
  it("throws Forbidden for a MEMBER and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(updateUserRole("target", "ADMIN")).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("throws Forbidden when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(updateUserRole("target", "ADMIN")).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("allows an ADMIN to update a role", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateUserRole("target", "PM");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "target" }, data: { role: "PM" } });
  });
  it("rejects an invalid role value even for ADMIN", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(updateUserRole("target", "SUPERUSER" as never)).rejects.toThrow("Invalid role");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("importUsers", () => {
  it("throws Forbidden for a non-admin and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await expect(importUsers(xlsxForm())).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("creates a new email with role MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(null);
    sheetRows = [{ Name: "Bùi Hữu Lợi", Account: "loi.buihuu", Gender: "Male" }];
    const res = await importUsers(xlsxForm());
    const arg = upsertMock.mock.calls[0][0] as { where: { email: string }; create: Record<string, unknown> };
    expect(arg.where.email).toBe("loi.buihuu@vti.com.vn");
    expect(arg.create.role).toBe("MEMBER");
    expect(arg.create.gender).toBe("Male");
    expect(arg.create.password).toBe("hashed-default");
    expect(res.created).toBe(1);
    expect(res.updated).toBe(0);
  });
  it("updates an existing email without changing role", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ id: "existing" });
    sheetRows = [{ Name: "Updated Name", Account: "loi.buihuu" }];
    const res = await importUsers(xlsxForm());
    const arg = upsertMock.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(arg.update).toHaveProperty("name", "Updated Name");
    expect(arg.update).toHaveProperty("dateOfBirth");
    expect(arg.update).toHaveProperty("gender");
    expect(arg.update).not.toHaveProperty("role");
    expect(arg.update).not.toHaveProperty("password");
    expect(res.updated).toBe(1);
    expect(res.created).toBe(0);
  });
  it("rejects when no file is provided", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(importUsers(new FormData())).rejects.toThrow(/file/i);
  });
});

describe("resetUserPassword", () => {
  it("throws Forbidden for a non-admin and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(resetUserPassword("target")).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("resets an existing user's password to the hashed default", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await resetUserPassword("target");
    expect(hashPasswordMock).toHaveBeenCalledWith("Vti@1234");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "target" }, data: { password: "hashed-default" } });
  });
});
