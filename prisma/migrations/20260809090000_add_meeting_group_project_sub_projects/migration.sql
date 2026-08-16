-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hasSubProjects" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Risk" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "MeetingGroup" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'On Track',
    "progressNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MeetingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingGroup_meetingId_idx" ON "MeetingGroup"("meetingId");

-- CreateIndex
CREATE INDEX "Milestone_groupId_idx" ON "Milestone"("groupId");

-- CreateIndex
CREATE INDEX "Risk_groupId_idx" ON "Risk"("groupId");

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MeetingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MeetingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingGroup" ADD CONSTRAINT "MeetingGroup_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

