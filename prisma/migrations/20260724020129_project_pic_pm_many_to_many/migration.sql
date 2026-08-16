-- Convert Project.picPmId (single FK) into a many-to-many Project <-> User
-- relation ("_ProjectPicPm"), preserving every existing assignment.

-- CreateTable
CREATE TABLE "_ProjectPicPm" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectPicPm_AB_unique" ON "_ProjectPicPm"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectPicPm_B_index" ON "_ProjectPicPm"("B");

-- AddForeignKey
ALTER TABLE "_ProjectPicPm" ADD CONSTRAINT "_ProjectPicPm_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectPicPm" ADD CONSTRAINT "_ProjectPicPm_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data
INSERT INTO "_ProjectPicPm" ("A", "B")
SELECT "id", "picPmId" FROM "Project" WHERE "picPmId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_picPmId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "picPmId";
