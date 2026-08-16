-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "weekEnd" TIMESTAMP(3),
ADD COLUMN     "weekStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "_ProjectPicPm" ADD CONSTRAINT "_ProjectPicPm_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ProjectPicPm_AB_unique";
