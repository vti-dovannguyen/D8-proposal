/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `Announcement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "expiresAt",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Announcement_active_pinned_createdAt_idx" ON "Announcement"("active", "pinned", "createdAt");
