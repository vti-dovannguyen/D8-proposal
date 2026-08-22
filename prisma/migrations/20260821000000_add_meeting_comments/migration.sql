-- CreateEnum
CREATE TYPE "MeetingCommentReactionValue" AS ENUM ('LIKE', 'UNLIKE');

-- CreateTable
CREATE TABLE "MeetingComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "MeetingComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingCommentReaction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" "MeetingCommentReactionValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingCommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingComment_meetingId_createdAt_idx" ON "MeetingComment"("meetingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCommentReaction_commentId_userId_key" ON "MeetingCommentReaction"("commentId", "userId");

-- CreateIndex
CREATE INDEX "MeetingCommentReaction_userId_idx" ON "MeetingCommentReaction"("userId");

-- AddForeignKey
ALTER TABLE "MeetingComment" ADD CONSTRAINT "MeetingComment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingComment" ADD CONSTRAINT "MeetingComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingCommentReaction" ADD CONSTRAINT "MeetingCommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "MeetingComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingCommentReaction" ADD CONSTRAINT "MeetingCommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
