"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

type Target = "topic" | "agent";

/** Toggle the current user's bookmark for a topic or agent. Returns the new state. */
export async function toggleBookmark(targetType: Target, targetId: string): Promise<{ bookmarked: boolean }> {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");
  const userId = session.user.id;

  const existing = await db.bookmark.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  });

  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
    revalidatePath("/workspace");
    return { bookmarked: false };
  }

  await db.bookmark.create({
    data: {
      userId,
      targetType,
      targetId,
      topicId: targetType === "topic" ? targetId : null,
      agentId: targetType === "agent" ? targetId : null,
    },
  });
  revalidatePath("/workspace");
  return { bookmarked: true };
}
