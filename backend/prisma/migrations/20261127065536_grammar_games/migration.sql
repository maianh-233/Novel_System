-- AlterTable
ALTER TABLE "PlaySession" ADD COLUMN     "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PlayQuestionAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB,
    "correct" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayQuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayQuestionAnswer_sessionId_idx" ON "PlayQuestionAnswer"("sessionId");

-- CreateIndex
CREATE INDEX "PlayQuestionAnswer_questionId_idx" ON "PlayQuestionAnswer"("questionId");

-- AddForeignKey
ALTER TABLE "PlayQuestionAnswer" ADD CONSTRAINT "PlayQuestionAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayQuestionAnswer" ADD CONSTRAINT "PlayQuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
