CREATE TYPE "AgentChatRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "AgentChatThread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentChatThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "AgentChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentChatThread_userId_agentId_updatedAt_idx" ON "AgentChatThread"("userId", "agentId", "updatedAt");
CREATE INDEX "AgentChatMessage_threadId_createdAt_idx" ON "AgentChatMessage"("threadId", "createdAt");

ALTER TABLE "AgentChatThread" ADD CONSTRAINT "AgentChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentChatThread" ADD CONSTRAINT "AgentChatThread_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AIAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentChatMessage" ADD CONSTRAINT "AgentChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
