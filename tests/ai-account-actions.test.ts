import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    aIAccount: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

import { createAIAccount, deleteAIAccount, updateAIAccount, type AIAccountFormData } from "../src/app/(portal)/ai-accounts/actions";

const valid: AIAccountFormData = {
  email: "AI@Example.com",
  provider: "OpenAI",
  accountType: "Team",
  project: "SBI Trading Platform",
  assignedToId: "u1",
  memberIds: ["u1", "u2"],
  purchaseDate: "2026-06-23",
  cost: "120",
  currency: "USD",
  subscriptionType: "Monthly",
  status: "ACTIVE",
  notes: "Shared account",
};

beforeEach(() => {
  authMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  findFirstMock.mockReset();
  findFirstMock.mockResolvedValue(null);
});

describe("AI account actions", () => {
  it("rejects non-managers", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(createAIAccount(valid)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates normalized account data and connects members", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createAIAccount(valid);
    const arg = createMock.mock.calls[0][0] as { data: { email: string; cost: number; assignedToId: string; members: { connect: Array<{ id: string }> } } };
    expect(arg.data.email).toBe("ai@example.com");
    expect(arg.data.cost).toBe(120);
    expect(arg.data.assignedToId).toBe("u1");
    expect(arg.data.members.connect).toEqual([{ id: "u1" }, { id: "u2" }]);
  });

  it("allows the same email to be issued to a different project", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findFirstMock.mockResolvedValue(null); // no existing row for THIS email+project pair
    await createAIAccount(valid);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { email: "ai@example.com", project: "SBI Trading Platform" },
      select: { id: true },
    });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate email for the same project", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findFirstMock.mockResolvedValue({ id: "existing1" });
    await expect(createAIAccount(valid)).rejects.toThrow("đã được cấp cho dự án");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("excludes the current row when checking duplicates on update", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findFirstMock.mockResolvedValue(null);
    await updateAIAccount("a1", valid);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { email: "ai@example.com", project: "SBI Trading Platform", id: { not: "a1" } },
      select: { id: true },
    });
  });

  it("updates and replaces member assignments", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await updateAIAccount("a1", { ...valid, memberIds: ["u3"] });
    const arg = updateMock.mock.calls[0][0] as { where: { id: string }; data: { members: { set: Array<{ id: string }> } } };
    expect(arg.where.id).toBe("a1");
    expect(arg.data.members.set).toEqual([{ id: "u3" }]);
  });

  it("deletes for managers", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "DIVISION_LEADER" } });
    await deleteAIAccount("a1");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "a1" } });
  });
});
