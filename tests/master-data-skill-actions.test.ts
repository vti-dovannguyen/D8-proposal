import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { skill: {
  create: (...a: unknown[]) => createMock(...a),
  update: vi.fn(),
  delete: (...a: unknown[]) => deleteMock(...a),
} } }));

import { createSkill, deleteSkill } from "../src/app/(portal)/master-data/skills/actions";

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); deleteMock.mockReset(); });

describe("skill actions auth", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createSkill({ name: "Java", category: "", active: true })).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("requires a name", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createSkill({ name: "  ", category: "", active: true })).rejects.toThrow(/name/i);
  });
  it("allows a manager to create", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "DIVISION_LEADER" } });
    await createSkill({ name: "Java", category: "Backend", active: true });
    expect(createMock).toHaveBeenCalled();
  });
  it("allows a manager to delete", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await deleteSkill("s1");
    expect(deleteMock).toHaveBeenCalled();
  });
});
