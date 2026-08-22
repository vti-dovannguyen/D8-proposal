"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canManageMeetingComments,
  nextMeetingCommentReaction,
  normalizeMeetingCommentContent,
  type MeetingCommentActionResult,
  type MeetingCommentReactionValue,
} from "@/lib/meeting-comments";

function validationFailure(error: unknown): MeetingCommentActionResult {
  if (!(error instanceof Error)) throw error;
  if (error.message === "Validation: empty comment") {
    return { ok: false, error: "Nội dung comment không được để trống." };
  }
  if (error.message === "Validation: comment is too long") {
    return { ok: false, error: "Comment không được vượt quá 2000 ký tự." };
  }
  throw error;
}

async function requireManager() {
  const session = await auth();
  if (!session?.user || !canManageMeetingComments(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session.user;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");
  return session.user;
}

async function getCommentOrThrow(commentId: string) {
  const comment = await db.meetingComment.findUnique({
    where: { id: commentId },
    select: { id: true, meetingId: true },
  });
  if (!comment) throw new Error("Not found");
  return comment;
}

export async function addMeetingComment(
  meetingId: string,
  formData: FormData,
): Promise<MeetingCommentActionResult> {
  const user = await requireManager();
  let content: string;
  try {
    content = normalizeMeetingCommentContent(String(formData.get("content") ?? ""));
  } catch (error) {
    return validationFailure(error);
  }
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, select: { id: true } });
  if (!meeting) throw new Error("Not found");

  await db.meetingComment.create({ data: { meetingId, authorId: user.id, content } });
  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

export async function updateMeetingComment(
  commentId: string,
  formData: FormData,
): Promise<MeetingCommentActionResult> {
  await requireManager();
  let content: string;
  try {
    content = normalizeMeetingCommentContent(String(formData.get("content") ?? ""));
  } catch (error) {
    return validationFailure(error);
  }
  const comment = await getCommentOrThrow(commentId);

  await db.meetingComment.update({
    where: { id: commentId },
    data: { content, editedAt: new Date() },
  });
  revalidatePath(`/meetings/${comment.meetingId}`);
  return { ok: true };
}

export async function deleteMeetingComment(commentId: string) {
  await requireManager();
  const comment = await getCommentOrThrow(commentId);

  await db.meetingComment.delete({ where: { id: commentId } });
  revalidatePath(`/meetings/${comment.meetingId}`);
}

export async function toggleMeetingCommentReaction(
  commentId: string,
  reaction: MeetingCommentReactionValue,
) {
  const user = await requireUser();
  if (reaction !== "LIKE" && reaction !== "UNLIKE") {
    throw new Error("Validation: invalid reaction");
  }
  const comment = await getCommentOrThrow(commentId);
  const where = { commentId_userId: { commentId, userId: user.id } };
  const current = await db.meetingCommentReaction.findUnique({ where });
  const next = nextMeetingCommentReaction(current?.value ?? null, reaction);

  if (next === null) {
    if (!current) throw new Error("Validation: missing current reaction");
    await db.meetingCommentReaction.delete({ where: { id: current.id } });
  } else {
    await db.meetingCommentReaction.upsert({
      where,
      update: { value: next },
      create: { commentId, userId: user.id, value: next },
    });
  }
  revalidatePath(`/meetings/${comment.meetingId}`);
}
