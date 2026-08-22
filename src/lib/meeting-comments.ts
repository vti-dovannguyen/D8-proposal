import { isManager } from "@/lib/permissions";
import type { Role } from "@/types";

export const MEETING_COMMENT_MAX_LENGTH = 2000;
export type MeetingCommentReactionValue = "LIKE" | "UNLIKE";
export type MeetingCommentActionResult = { ok: true } | { ok: false; error: string };

export function normalizeMeetingCommentContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) throw new Error("Validation: empty comment");
  if (normalized.length > MEETING_COMMENT_MAX_LENGTH) {
    throw new Error("Validation: comment is too long");
  }
  return normalized;
}

export function canManageMeetingComments(role: Role): boolean {
  return isManager(role);
}

export function getMeetingCommentDisplayState(createdAt: string, editedAt: string | null) {
  return {
    timestamp: editedAt ?? createdAt,
    edited: editedAt !== null,
  };
}

export function nextMeetingCommentReaction(
  current: MeetingCommentReactionValue | null,
  next: MeetingCommentReactionValue,
): MeetingCommentReactionValue | null {
  return current === next ? null : next;
}
