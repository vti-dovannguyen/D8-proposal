-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "serverInfo" TEXT;

-- AlterTable
ALTER TABLE "ProjectAllocation" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backlogAccount" TEXT,
ADD COLUMN     "gitAccount" TEXT,
ADD COLUMN     "twoFA" BOOLEAN NOT NULL DEFAULT false;
