-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "impact" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "rootCause" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "actionPlan" TEXT,
    "supportNeeded" TEXT,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
