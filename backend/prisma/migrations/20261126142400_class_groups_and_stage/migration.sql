-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('primary', 'secondary');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "stage" "Stage" DEFAULT 'primary';

-- AlterTable
ALTER TABLE "PlaySession" ADD COLUMN     "stage" "Stage" NOT NULL DEFAULT 'primary';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "classId" TEXT;

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "stage" "Stage" NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassGroup_isArchived_idx" ON "ClassGroup"("isArchived");

-- CreateIndex
CREATE INDEX "Student_classId_idx" ON "Student"("classId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
