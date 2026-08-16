-- DropIndex
DROP INDEX "AIAccount_email_key";

-- AlterTable
ALTER TABLE "AIAccount" ADD COLUMN     "assignedToId" TEXT;

-- CreateIndex
CREATE INDEX "AIAccount_email_idx" ON "AIAccount"("email");

-- AddForeignKey
ALTER TABLE "AIAccount" ADD CONSTRAINT "AIAccount_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

