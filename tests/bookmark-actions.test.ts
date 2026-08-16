import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    bookmark: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      create: (...a: unknown[]) => createMock(...a),
      delete: (...a: unknown[]) => deleteMock(...a),
    },
  },
}));

import { toggleBookmark } from "../src/app/(portal)/workspace/actions";

beforeEach(() => { authMock.mockReset(); findUniqueMock.mockReset(); createMock.mockReset(); deleteMock.mockReset(); });

describe("toggleBookmark", () => {
  it("rejects when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(toggleBookmark("topic", "t1")).rejects.toThrow("Forbidden");
  });
  it("creates a bookmark when none exists and sets the topic relation", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    findUniqueMock.mockResolvedValue(null);
    const res = await toggleBookmark("topic", "t1");
    expect(res).toEqual({ bookmarked: true });
    const arg = createMock.mock.calls[0][0] as { data: { userId: string; targetType: string; targetId: string; topicId: string | null; agentId: string | null } };
    expect(arg.data).toMatchObject({ userId: "u1", targetType: "topic", targetId: "t1", topicId: "t1", agentId: null });
  });
  it("sets the agent relation for an agent bookmark", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    findUniqueMock.mockResolvedValue(null);
    await toggleBookmark("agent", "a9");
    const arg = createMock.mock.calls[0][0] as { data: { topicId: string | null; agentId: string | null } };
    expect(arg.data).toMatchObject({ agentId: "a9", topicId: null });
  });
  it("removes an existing bookmark (toggle off)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    findUniqueMock.mockResolvedValue({ id: "b1" });
    const res = await toggleBookmark("topic", "t1");
    expect(res).toEqual({ bookmarked: false });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "b1" } });
    expect(createMock).not.toHaveBeenCalled();
  });
});
