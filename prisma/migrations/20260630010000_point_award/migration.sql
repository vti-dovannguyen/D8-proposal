-- CreateEnum
CREATE TYPE "PointAwardType" AS ENUM ('PERSON', 'PROJECT');

-- CreateTable
CREATE TABLE "PointAward" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" "PointAwardType" NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointAward_month_userId_key" ON "PointAward"("month", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PointAward_month_projectId_key" ON "PointAward"("month", "projectId");

-- CreateIndex
CREATE INDEX "PointAward_month_type_idx" ON "PointAward"("month", "type");

-- AddForeignKey
ALTER TABLE "PointAward" ADD CONSTRAINT "PointAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAward" ADD CONSTRAINT "PointAward_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAward" ADD CONSTRAINT "PointAward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
