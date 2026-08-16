-- CreateTable
CREATE TABLE "ProjectAllocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "skillId" TEXT,
    "hoursPerDay" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAllocation_projectId_idx" ON "ProjectAllocation"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
