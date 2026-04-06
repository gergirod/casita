/*
  Warnings:

  - You are about to drop the column `ownerPhone` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `whatsappEnabled` on the `Workspace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "ownerPhone",
DROP COLUMN "whatsappEnabled";

-- CreateTable
CREATE TABLE "OwnerProfile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "phone" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerProfile_ownerId_key" ON "OwnerProfile"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerProfile_phone_idx" ON "OwnerProfile"("phone");
