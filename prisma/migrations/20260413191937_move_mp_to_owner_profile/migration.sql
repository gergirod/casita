-- AlterTable
ALTER TABLE "OwnerProfile" ADD COLUMN     "mpAccessTokenEncrypted" TEXT,
ADD COLUMN     "mpConnectedAt" TIMESTAMP(3),
ADD COLUMN     "mpUserId" TEXT;
