import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const meetingFindUniqueMock = vi.fn();
const commentCreateMock = vi.fn();
const commentFindUniqueMock = vi.fn();
const commentUpdateMock = vi.fn();
const commentDeleteMock = vi.fn();
const reactionFindUniqueMock = vi.fn();
const reactionDeleteMock = vi.fn();
const reactionUpsertMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock("@/lib/db", () => ({
  db: {
    meeting: { findUnique: (...args: unknown[]) => meetingFindUniqueMock(...args) },
    meetingComment: {
      create: (...args: unknown[]) => commentCreateMock(...args),
      findUnique: (...args: unknown[]) => commentFindUniqueMock(...args),
      update: (...args: unknown[]) => commentUpdateMock(...args),
      delete: (...args: unknown[]) => commentDeleteMock(...args),
    },
    meetingCommentReaction: {
      findUnique: (...args: unknown[]) => reactionFindUniqueMock(...args),
      delete: (...args: unknown[]) => reactionDeleteMock(...args),
      upsert: (...args: unknown[]) => reactionUpsertMock(...args),
    },
  },
}));

import {
  addMeetingComment,
  deleteMeetingComment,
  toggleMeetingCommentReaction,
  updateMeetingComment,
} from "../src/app/(portal)/meetings/meeting-comment-actions";

function form(content: string) {
  const data = new FormData();
  data.set("content", content);
  return data;
}

beforeEach(() => {
  authMock.mockReset();
  meetingFindUniqueMock.mockReset();
  commentCreateMock.mockReset();
  commentFindUniqueMock.mockReset();
  commentUpdateMock.mockReset();
  commentDeleteMock.mockReset();
  reactionFindUniqueMock.mockReset();
  reactionDeleteMock.mockReset();
  reactionUpsertMock.mockReset();
  revalidatePathMock.mockReset();
  commentCreateMock.mockResolvedValue({ id: "comment-1" });
  commentUpdateMock.mockResolvedValue({ id: "comment-1" });
  commentDeleteMock.mockResolvedValue({ id: "comment-1" });
  reactionDeleteMock.mockResolvedValue({ id: "reaction-1" });
  reactionUpsertMock.mockResolvedValue({ id: "reaction-1" });
});

describe("addMeetingComment", () => {
  it("rejects a PM because only managers can submit Manager comments", async () => {
    authMock.mockResolvedValue({ user: { id: "pm-1", role: "PM" } });

    await expect(addMeetingComment("meeting-1", form("Comment"))).rejects.toThrow("Forbidden");
    expect(commentCreateMock).not.toHaveBeenCalled();
  });

  it("rejects empty content before touching the database", async () => {
    authMock.mockResolvedValue({ user: { id: "manager-1", role: "SECTION_MANAGER" } });

    await expect(addMeetingComment("meeting-1", form("  "))).resolves.toEqual({
      ok: false,
      error: "Nội dung comment không được để trống.",
    });
    expect(meetingFindUniqueMock).not.toHaveBeenCalled();
    expect(commentCreateMock).not.toHaveBeenCalled();
  });

  it("creates a normalized comment and revalidates the meeting detail", async () => {
    authMock.mockResolvedValue({ user: { id: "manager-1", role: "SECTION_MANAGER" } });
    meetingFindUniqueMock.mockResolvedValue({ id: "meeting-1" });

    await expect(addMeetingComment("meeting-1", form("  Comment  "))).resolves.toEqual({ ok: true });

    expect(commentCreateMock).toHaveBeenCalledWith({
      data: { meetingId: "meeting-1", authorId: "manager-1", content: "Comment" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/meetings/meeting-1");
  });
});

describe("updateMeetingComment", () => {
  it("returns a validation result without updating an empty comment", async () => {
    authMock.mockResolvedValue({ user: { id: "manager-1", role: "SECTION_MANAGER" } });

    await expect(updateMeetingComment("comment-1", form("  "))).resolves.toEqual({
      ok: false,
      error: "Nội dung comment không được để trống.",
    });
    expect(commentFindUniqueMock).not.toHaveBeenCalled();
    expect(commentUpdateMock).not.toHaveBeenCalled();
  });

  it("updates a comment and revalidates its parent meeting", async () => {
    authMock.mockResolvedValue({ user: { id: "manager-1", role: "ADMIN" } });
    commentFindUniqueMock.mockResolvedValue({ id: "comment-1", meetingId: "meeting-1" });

    await expect(updateMeetingComment("comment-1", form(" Revised comment "))).resolves.toEqual({ ok: true });

    expect(commentUpdateMock).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { content: "Revised comment", editedAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/meetings/meeting-1");
  });
});

describe("deleteMeetingComment", () => {
  it("deletes a comment and revalidates its parent meeting", async () => {
    authMock.mockResolvedValue({ user: { id: "manager-1", role: "DIVISION_LEADER" } });
    commentFindUniqueMock.mockResolvedValue({ id: "comment-1", meetingId: "meeting-1" });

    await deleteMeetingComment("comment-1");

    expect(commentDeleteMock).toHaveBeenCalledWith({ where: { id: "comment-1" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/meetings/meeting-1");
  });
});

describe("toggleMeetingCommentReaction", () => {
  it("lets a signed-in user remove their existing like", async () => {
    authMock.mockResolvedValue({ user: { id: "member-1", role: "MEMBER" } });
    commentFindUniqueMock.mockResolvedValue({ id: "comment-1", meetingId: "meeting-1" });
    reactionFindUniqueMock.mockResolvedValue({ id: "reaction-1", value: "LIKE" });

    await toggleMeetingCommentReaction("comment-1", "LIKE");

    expect(reactionDeleteMock).toHaveBeenCalledWith({ where: { id: "reaction-1" } });
    expect(reactionUpsertMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/meetings/meeting-1");
  });

  it("switches an existing reaction to the selected opposite value", async () => {
    authMock.mockResolvedValue({ user: { id: "pm-1", role: "PM" } });
    commentFindUniqueMock.mockResolvedValue({ id: "comment-1", meetingId: "meeting-1" });
    reactionFindUniqueMock.mockResolvedValue({ id: "reaction-1", value: "LIKE" });

    await toggleMeetingCommentReaction("comment-1", "UNLIKE");

    expect(reactionUpsertMock).toHaveBeenCalledWith({
      where: { commentId_userId: { commentId: "comment-1", userId: "pm-1" } },
      update: { value: "UNLIKE" },
      create: { commentId: "comment-1", userId: "pm-1", value: "UNLIKE" },
    });
    expect(reactionDeleteMock).not.toHaveBeenCalled();
  });
});
