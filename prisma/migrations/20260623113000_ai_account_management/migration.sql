CREATE TABLE "AIAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "project" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subscriptionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_AIAccountMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "AIAccount_email_key" ON "AIAccount"("email");
CREATE UNIQUE INDEX "_AIAccountMembers_AB_unique" ON "_AIAccountMembers"("A", "B");
CREATE INDEX "_AIAccountMembers_B_index" ON "_AIAccountMembers"("B");

ALTER TABLE "_AIAccountMembers" ADD CONSTRAINT "_AIAccountMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "AIAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AIAccountMembers" ADD CONSTRAINT "_AIAccountMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
