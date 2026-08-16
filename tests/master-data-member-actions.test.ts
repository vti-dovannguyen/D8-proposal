import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsertMock = vi.fn();
const certCreateMock = vi.fn();
const userUpdateMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({ uploadAttachmentFile: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  userSkill: { upsert: (...a: unknown[]) => upsertMock(...a), delete: vi.fn() },
  userCertificate: { create: (...a: unknown[]) => certCreateMock(...a), delete: vi.fn() },
  user: { update: (...a: unknown[]) => userUpdateMock(...a) },
} }));

import { setUserSkill, addUserCertificate, setEmployeeType } from "../src/app/(portal)/master-data/members/[id]/actions";

beforeEach(() => { authMock.mockReset(); upsertMock.mockReset(); certCreateMock.mockReset(); userUpdateMock.mockReset(); });

describe("member actions auth", () => {
  it("blocks a MEMBER from assigning a skill", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(setUserSkill("user2", "skill1", 3)).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("clamps level to 1..5 for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await setUserSkill("user2", "skill1", 9);
    const arg = upsertMock.mock.calls[0][0] as { create: { level: number } };
    expect(arg.create.level).toBe(5);
  });
  it("requires a certificate type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const fd = new FormData();
    // Use a cuid-length id so validation reaches the type check (not the id-format guard).
    await expect(addUserCertificate("clusr0000000000000001", fd)).rejects.toThrow(/type/i);
  });
  it("blocks a MEMBER from adding a certificate", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(addUserCertificate("clusr0000000000000001", new FormData())).rejects.toThrow("Forbidden");
    expect(certCreateMock).not.toHaveBeenCalled();
  });
  it("blocks a MEMBER from changing employee type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(setEmployeeType("user2", "INTERN")).rejects.toThrow("Forbidden");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });
  it("rejects an invalid employee type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(setEmployeeType("user2", "BOGUS" as never)).rejects.toThrow(/employee type/i);
    expect(userUpdateMock).not.toHaveBeenCalled();
  });
  it("lets a manager set the employee type", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await setEmployeeType("user2", "INTERN");
    const arg = userUpdateMock.mock.calls[0][0] as { where: { id: string }; data: { employeeType: string } };
    expect(arg).toEqual({ where: { id: "user2" }, data: { employeeType: "INTERN" } });
  });
});
