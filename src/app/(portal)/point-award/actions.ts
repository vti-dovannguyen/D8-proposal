"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MONTH_RE } from "@/lib/monthly-detail";
import { validatePoints, POINT_AWARD_TYPES, type PointAwardType } from "@/lib/point-award";
import { sendPointAwardCard } from "@/lib/google-chat";
import { uploadDocumentFile, getSignedUrl, removeFromBucket } from "@/lib/storage";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];

async function requireAwarder() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "point:award")) throw new Error("Forbidden");
  return session.user;
}

export type CreatePointAwardInput = {
  month: string;
  type: PointAwardType;
  userId?: string;
  projectId?: string;
  points: number;
  reason: string;
  sendNotification: boolean;
  imageFile?: File | null;
};

export async function createPointAward(input: CreatePointAwardInput) {
  const awarder = await requireAwarder();
  if (!MONTH_RE.test(input.month)) throw new Error("Validation: tháng không hợp lệ (YYYY-MM)");
  if (!POINT_AWARD_TYPES.includes(input.type)) throw new Error("Validation: loại không hợp lệ");
  const points = validatePoints(input.points);
  const reason = input.reason.trim();
  if (!reason) throw new Error("Validation: lý do là bắt buộc");

  // Image is accepted only when notifying. Validate early so a bad file is rejected before any write.
  const imageFile = input.sendNotification && input.imageFile && input.imageFile.size > 0 ? input.imageFile : null;
  if (imageFile) {
    const ext = imageFile.name.slice(imageFile.name.lastIndexOf(".") + 1).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) throw new Error("Validation: ảnh phải là png/jpg/jpeg/gif/webp");
  }

  const targetUserId = input.type === "PERSON" ? (input.userId ?? "").trim() : "";
  const targetProjectId = input.type === "PROJECT" ? (input.projectId ?? "").trim() : "";
  if (input.type === "PERSON" && !targetUserId) throw new Error("Validation: chọn cá nhân");
  if (input.type === "PROJECT" && !targetProjectId) throw new Error("Validation: chọn dự án");

  const where =
    input.type === "PERSON"
      ? { month_userId: { month: input.month, userId: targetUserId } }
      : { month_projectId: { month: input.month, projectId: targetProjectId } };

  const award = await db.pointAward.upsert({
    where,
    create: {
      month: input.month,
      type: input.type,
      userId: targetUserId || null,
      projectId: targetProjectId || null,
      points,
      reason,
      createdById: awarder.id,
    },
    update: { points, reason, createdById: awarder.id },
  });

  if (input.sendNotification) {
    let imagePath: string | null = null;
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      imagePath = `point-awards/${award.id}/${Date.now()}_${safeName}`;
      await uploadDocumentFile(imagePath, imageFile);
      await db.pointAward.update({ where: { id: award.id }, data: { imageUrl: imagePath } });
    }
    const targetName =
      input.type === "PERSON"
        ? (await db.user.findUnique({ where: { id: targetUserId }, select: { name: true } }))?.name ?? "N/A"
        : (await db.project.findUnique({ where: { id: targetProjectId }, select: { name: true } }))?.name ?? "N/A";
    const sent = await sendPointAwardCard({
      targetName,
      targetKind: input.type,
      points,
      reason,
      month: input.month,
      awarderName: awarder.name ?? "Quản lý",
      leaderboardUrl: process.env.APP_URL ? `${process.env.APP_URL}/point-award` : "",
      imageUrl: imagePath ? await getSignedUrl(imagePath) : undefined,
      celebrationGifUrl: process.env.APP_URL ? `${process.env.APP_URL}/point-award-celebration.gif` : "",
    });
    if (sent) {
      await db.pointAward.update({ where: { id: award.id }, data: { notified: true, notifiedAt: new Date() } });
    }
  }
  revalidatePath("/point-award");
}

export async function deletePointAward(id: string) {
  await requireAwarder();
  const existing = await db.pointAward.findUnique({ where: { id }, select: { imageUrl: true } });
  await db.pointAward.delete({ where: { id } });
  if (existing?.imageUrl) {
    try {
      await removeFromBucket(existing.imageUrl);
    } catch (e) {
      console.error("Failed to remove point-award image:", e);
    }
  }
  revalidatePath("/point-award");
}
