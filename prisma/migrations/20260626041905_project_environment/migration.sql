-- CreateTable
CREATE TABLE "ProjectEnvironment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "username" TEXT,
    "password" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectEnvironment_projectId_idx" ON "ProjectEnvironment"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectEnvironment" ADD CONSTRAINT "ProjectEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
