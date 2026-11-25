-- Rollar: məlumat itirmədən adların dəyişdirilməsi
-- STAFF (kitabxana əməkdaşı) → SUPERVISOR, ADMIN → SUPERADMIN
ALTER TYPE "Role" RENAME VALUE 'STAFF' TO 'SUPERVISOR';
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'SUPERADMIN';

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "maintenanceNote" TEXT,
ADD COLUMN     "maintenanceSince" TIMESTAMP(3),
ADD COLUMN     "underMaintenance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Library" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "bookingEndMinute" INTEGER,
ADD COLUMN     "bookingStartMinute" INTEGER,
ADD COLUMN     "facultyId" TEXT;

-- AlterTable
ALTER TABLE "LoginCode" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'login';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "maintenanceNote" TEXT,
ADD COLUMN     "maintenanceSince" TIMESTAMP(3),
ADD COLUMN     "underMaintenance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "facultyId" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "libraryId" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordSetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_name_key" ON "Faculty"("name");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "User_facultyId_idx" ON "User"("facultyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mövcud adları ad/soyad sahələrinə köçür
UPDATE "User" SET "firstName" = split_part("name", ' ', 1),
                  "lastName" = NULLIF(substr("name", length(split_part("name", ' ', 1)) + 2), '')
WHERE "name" IS NOT NULL AND "firstName" IS NULL;
