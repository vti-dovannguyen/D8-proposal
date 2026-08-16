import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { userSkill: {
  upsert: (...a: unknown[]) => upsertMock(...a),
  deleteMany: (...a: unknown[]) => deleteManyMock(...a),
} } }));

import { setSkillLevel } from "../src/app/(portal)/master-data/skill-matrix/actions";

beforeEach(() => { authMock.mockReset(); upsertMock.mockReset(); deleteManyMock.mockReset(); });

describe("setSkillLevel", () => {
  it("blocks a MEMBER and does not write", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(setSkillLevel("u1", "s1", 3)).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("blocks a PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "PM" } });
    await expect(setSkillLevel("u1", "s1", 3)).rejects.toThrow("Forbidden");
  });
  it("rejects out-of-range / non-integer levels", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(setSkillLevel("u1", "s1", 6)).rejects.toThrow(/level/i);
    await expect(setSkillLevel("u1", "s1", -1)).rejects.toThrow(/level/i);
    await expect(setSkillLevel("u1", "s1", 1.5)).rejects.toThrow(/level/i);
  });
  it("deletes when level is 0", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "SECTION_MANAGER" } });
    await setSkillLevel("u1", "s1", 0);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { userId: "u1", skillId: "s1" } });
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("upserts when level is 1..5", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await setSkillLevel("u1", "s1", 3);
    const arg = upsertMock.mock.calls[0][0] as { create: { level: number }; update: { level: number } };
    expect(arg.create.level).toBe(3);
    expect(arg.update.level).toBe(3);
  });
});
