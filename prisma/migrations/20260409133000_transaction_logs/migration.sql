-- Add audit log for owner transaction edits/voids

-- CreateEnum
CREATE TYPE "TransactionLogAction" AS ENUM ('EDIT', 'SOFT_DELETE');

-- CreateTable
CREATE TABLE "TransactionLog" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" "TransactionLogAction" NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionLog_transactionId_createdAt_idx" ON "TransactionLog"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_actorUserId_createdAt_idx" ON "TransactionLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

