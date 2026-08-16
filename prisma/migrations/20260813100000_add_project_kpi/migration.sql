-- CreateTable
CREATE TABLE "ProjectKpi" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "kpiType" TEXT NOT NULL DEFAULT 'A',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectKpi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectKpi_projectId_idx" ON "ProjectKpi"("projectId");

-- CreateIndex
CREATE INDEX "ProjectKpi_month_idx" ON "ProjectKpi"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectKpi_projectId_month_kpiType_userId_key" ON "ProjectKpi"("projectId", "month", "kpiType", "userId");

-- AddForeignKey
ALTER TABLE "ProjectKpi" ADD CONSTRAINT "ProjectKpi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKpi" ADD CONSTRAINT "ProjectKpi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
