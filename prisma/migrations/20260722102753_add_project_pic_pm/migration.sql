-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "picPmId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_picPmId_fkey" FOREIGN KEY ("picPmId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
