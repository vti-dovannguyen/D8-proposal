import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { masterCategory: {
    create: (...a: unknown[]) => createMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
  } },
}));

import { createCategory, updateCategory, deleteCategory } from "../src/app/(portal)/master-data/categories/actions";

const form = { type: "PROJECT", value: "New", order: 0, active: true };

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); updateMock.mockReset(); deleteMock.mockReset(); });

describe("category actions auth", () => {
  it("blocks a MEMBER from creating", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createCategory(form)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("blocks a PM from updating", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(updateCategory("c1", form)).rejects.toThrow("Forbidden");
  });
  it("allows a manager to create with a valid type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await createCategory(form);
    expect(createMock).toHaveBeenCalled();
  });
  it("rejects an unknown category type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createCategory({ ...form, type: "BOGUS" })).rejects.toThrow(/type/i);
  });
  it("allows a manager to delete", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await deleteCategory("c1");
    expect(deleteMock).toHaveBeenCalled();
  });
});
