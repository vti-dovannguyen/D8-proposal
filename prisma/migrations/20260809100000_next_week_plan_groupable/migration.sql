-- AlterTable
ALTER TABLE "NextWeekPlan" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "meetingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "NextWeekPlan_groupId_idx" ON "NextWeekPlan"("groupId");

-- AddForeignKey
ALTER TABLE "NextWeekPlan" ADD CONSTRAINT "NextWeekPlan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MeetingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

