-- CreateTable
CREATE TABLE "UnitMonthly" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "lbQaOt" INTEGER NOT NULL DEFAULT 0,
    "intern" INTEGER NOT NULL DEFAULT 0,
    "official" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitMonthly_month_key" ON "UnitMonthly"("month");
