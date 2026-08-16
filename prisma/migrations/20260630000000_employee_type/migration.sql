-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('OFFICIAL', 'INTERN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "employeeType" "EmployeeType" NOT NULL DEFAULT 'OFFICIAL';
