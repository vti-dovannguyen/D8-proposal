import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const topicCreate = vi.fn();
const topicUpdate = vi.fn();
const topicDelete = vi.fn();
const topicFindUnique = vi.fn();
const commentCreate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/db", () => ({
  db: {
    topic: {
      create: (...args: unknown[]) => topicCreate(...args),
      update: (...args: unknown[]) => topicUpdate(...args),
      delete: (...args: unknown[]) => topicDelete(...args),
      findUnique: (...args: unknown[]) => topicFindUnique(...args),
    },
    comment: { create: (...args: unknown[]) => commentCreate(...args) },
    bookmark: { deleteMany: vi.fn() },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));

import { addComment, createTopic, deleteTopic, likeTopic, pinTopic } from "../src/app/(portal)/topics/actions";
import type { TopicFormData } from "@/types/community";

const validForm: TopicFormData = {
  title: "Hỏi về CI",
  content: "Nội dung",
  category: "Kỹ thuật",
  project: "SBI Trading Platform",
  tags: "ci, devops",
};

function fd(content: string): FormData {
  const form = new FormData();
  form.set("content", content);
  return form;
}

beforeEach(() => {
  authMock.mockReset();
  topicCreate.mockReset();
  topicUpdate.mockReset();
  topicDelete.mockReset();
  topicFindUnique.mockReset();
  commentCreate.mockReset();
  topicCreate.mockResolvedValue({ id: "t1" });
});

describe("createTopic", () => {
  it("rejects when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    await expect(createTopic(validForm)).rejects.toThrow("Forbidden");
  });

  it("rejects a blank title", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createTopic({ ...validForm, title: "  " })).rejects.toThrow("Validation");
    expect(topicCreate).not.toHaveBeenCalled();
  });

  it("creates for any member, sets authorId and project, redirects to the new topic", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createTopic(validForm)).rejects.toThrow("REDIRECT:/topics/t1");
    const arg = topicCreate.mock.calls[0][0] as { data: { authorId: string; project: string } };
    expect(arg.data.authorId).toBe("u1");
    expect(arg.data.project).toBe("SBI Trading Platform");
  });
});

describe("addComment", () => {
  it("rejects a blank comment", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(addComment("t1", fd("   "))).rejects.toThrow("Validation");
    expect(commentCreate).not.toHaveBeenCalled();
  });

  it("creates a comment for an authenticated user", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await addComment("t1", fd("Bình luận"));
    const arg = commentCreate.mock.calls[0][0] as { data: { topicId: string; authorId: string; content: string } };
    expect(arg.data).toMatchObject({ topicId: "t1", authorId: "u1", content: "Bình luận" });
  });
});

describe("likeTopic", () => {
  it("increments likes", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await likeTopic("t1");
    const arg = topicUpdate.mock.calls[0][0] as { data: { likes: { increment: number } } };
    expect(arg.data.likes).toEqual({ increment: 1 });
  });
});

describe("pinTopic", () => {
  it("rejects a non-manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(pinTopic("t1", true)).rejects.toThrow("Forbidden");
    expect(topicUpdate).not.toHaveBeenCalled();
  });

  it("sets pinned for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u2", role: "SECTION_MANAGER" } });
    await pinTopic("t1", true);
    const arg = topicUpdate.mock.calls[0][0] as { data: { pinned: boolean } };
    expect(arg.data.pinned).toBe(true);
  });
});

describe("deleteTopic", () => {
  it("rejects a non-author non-manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u9", role: "MEMBER" } });
    topicFindUnique.mockResolvedValue({ id: "t1", authorId: "u1" });
    await expect(deleteTopic("t1")).rejects.toThrow("Forbidden");
    expect(topicDelete).not.toHaveBeenCalled();
  });

  it("lets the author delete and redirects to the list", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    topicFindUnique.mockResolvedValue({ id: "t1", authorId: "u1" });
    await expect(deleteTopic("t1")).rejects.toThrow("REDIRECT:/topics");
    expect(topicDelete).toHaveBeenCalledWith({ where: { id: "t1" } });
    const { db } = await import("@/lib/db");
    expect(db.bookmark.deleteMany).toHaveBeenCalledWith({ where: { targetType: "topic", targetId: "t1" } });
  });
});
