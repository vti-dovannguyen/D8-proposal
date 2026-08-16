import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/db", () => ({
  db: {
    aIAgent: {
      create: (...a: unknown[]) => createMock(...a),
      delete: (...a: unknown[]) => deleteMock(...a),
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
    },
    bookmark: { deleteMany: vi.fn() },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));

import { createAgent, deleteAgent } from "../src/app/(portal)/agents/actions";
import type { AgentFormData } from "@/types/community";

const valid: AgentFormData = { name: "BrSE Helper", description: "Trợ lý BrSE", useCase: "Dịch tài liệu", prompt: "Bạn là trợ lý dịch.", category: "Dịch thuật" };

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); deleteMock.mockReset(); findUniqueMock.mockReset(); createMock.mockResolvedValue({ id: "a1" }); });

describe("createAgent", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(createAgent(valid)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects missing required fields", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createAgent({ ...valid, name: " " })).rejects.toThrow("Validation");
    await expect(createAgent({ ...valid, prompt: " " })).rejects.toThrow("Validation");
  });
  it("creates for an editor, sets ownerId, and returns the new agent id", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createAgent(valid)).resolves.toEqual({ id: "a1" });
    const arg = createMock.mock.calls[0][0] as { data: { ownerId: string } };
    expect(arg.data.ownerId).toBe("u3");
  });
});

describe("deleteAgent", () => {
  it("rejects a non-owner non-manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u9", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "a1", ownerId: "u3" });
    await expect(deleteAgent("a1")).rejects.toThrow("Forbidden");
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("lets the owner delete and redirects to the catalog", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "a1", ownerId: "u3" });
    await expect(deleteAgent("a1")).rejects.toThrow("REDIRECT:/agents");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "a1" } });
    const { db } = await import("@/lib/db");
    expect(db.bookmark.deleteMany).toHaveBeenCalledWith({ where: { targetType: "agent", targetId: "a1" } });
  });
  it("lets a manager delete someone else's agent", async () => {
    authMock.mockResolvedValue({ user: { id: "u9", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ id: "a1", ownerId: "u3" });
    await expect(deleteAgent("a1")).rejects.toThrow("REDIRECT:/agents");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    const { db } = await import("@/lib/db");
    expect(db.bookmark.deleteMany).toHaveBeenCalledWith({ where: { targetType: "agent", targetId: "a1" } });
  });
});
