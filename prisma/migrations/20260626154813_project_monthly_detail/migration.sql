-- CreateTable
CREATE TABLE "ProjectMonthlyDetail" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "billableProject" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billableDevelop" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warrantyEffort" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calendarMember" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calendarIntern" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calendarCollaborator" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otMemberEffort" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otInternEffort" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otCollaboratorEffort" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eeToMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMonthlyDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMonthlyDetail_projectId_idx" ON "ProjectMonthlyDetail"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMonthlyDetail_projectId_month_key" ON "ProjectMonthlyDetail"("projectId", "month");

-- AddForeignKey
ALTER TABLE "ProjectMonthlyDetail" ADD CONSTRAINT "ProjectMonthlyDetail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
