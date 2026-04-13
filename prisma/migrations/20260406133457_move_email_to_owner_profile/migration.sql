/*
  Warnings:

  - You are about to drop the column `emailAddress` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `emailConnectedAt` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `emailEncryptedPassword` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `emailProvider` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `emailRefreshToken` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `imapHost` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `imapPort` on the `Workspace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OwnerProfile" ADD COLUMN     "emailAddress" TEXT,
ADD COLUMN     "emailConnectedAt" TIMESTAMP(3),
ADD COLUMN     "emailEncryptedPassword" TEXT,
ADD COLUMN     "emailProvider" TEXT,
ADD COLUMN     "emailRefreshToken" TEXT,
ADD COLUMN     "imapHost" TEXT,
ADD COLUMN     "imapPort" INTEGER;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "emailAddress",
DROP COLUMN "emailConnectedAt",
DROP COLUMN "emailEncryptedPassword",
DROP COLUMN "emailProvider",
DROP COLUMN "emailRefreshToken",
DROP COLUMN "imapHost",
DROP COLUMN "imapPort";
