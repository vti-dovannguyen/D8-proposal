-- AlterTable
ALTER TABLE "Risk" DROP COLUMN "category",
DROP COLUMN "description",
DROP COLUMN "rootCause",
DROP COLUMN "supportNeeded",
ADD COLUMN     "planDate" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Issue';

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "note" TEXT,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextWeekPlan" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "keyActivity" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "NextWeekPlan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextWeekPlan" ADD CONSTRAINT "NextWeekPlan_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

