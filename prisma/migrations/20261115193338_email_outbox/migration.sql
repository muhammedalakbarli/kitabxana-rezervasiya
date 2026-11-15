/*
  Warnings:

  - You are about to drop the column `hasIcs` on the `EmailLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EmailLog" DROP COLUMN "hasIcs",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ics" TEXT,
ADD COLUMN     "icsMethod" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "text" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
