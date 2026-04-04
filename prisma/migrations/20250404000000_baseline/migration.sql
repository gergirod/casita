-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ObligationType" AS ENUM ('rent', 'expensas', 'electricity', 'gas', 'water', 'internet', 'custom');

-- CreateEnum
CREATE TYPE "ObligationSourceType" AS ENUM ('recurring_rent', 'manual', 'n8n');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('upcoming', 'pending', 'reminded', 'proof_uploaded', 'verified', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('due_soon', 'due_today', 'overdue', 'proof_uploaded_owner', 'payment_confirmed');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-AR',
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "defaultTone" TEXT NOT NULL DEFAULT 'friendly',
    "n8nWebhookUrl" TEXT,
    "n8nSecret" TEXT,
    "emailProvider" TEXT,
    "emailAddress" TEXT,
    "emailEncryptedPassword" TEXT,
    "emailRefreshToken" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "emailConnectedAt" TIMESTAMP(3),
    "mpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mpAccessTokenEncrypted" TEXT,
    "mpPublicKey" TEXT,
    "mpUserId" TEXT,
    "mpPaymentLink" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ownerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantToken" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "contractUrl" TEXT,
    "contractText" TEXT,
    "leaseEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractHistory" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantContact" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "welcomeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationTemplate" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" "ObligationType" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "dueDay" INTEGER NOT NULL,
    "providerSlug" TEXT,
    "ingestionMode" TEXT NOT NULL DEFAULT 'manual',
    "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "reminderChannel" TEXT NOT NULL DEFAULT 'email',
    "remindBefore" BOOLEAN NOT NULL DEFAULT true,
    "remindOnDue" BOOLEAN NOT NULL DEFAULT true,
    "remindOverdue" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethod" TEXT,
    "paymentCbu" TEXT,
    "paymentName" TEXT,
    "paymentMpLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObligationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obligation" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "templateId" TEXT,
    "type" "ObligationType" NOT NULL,
    "sourceType" "ObligationSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueMonth" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" "ObligationStatus" NOT NULL,
    "notes" TEXT,
    "originalBillUrl" TEXT,
    "proofUrl" TEXT,
    "proofUploadedAt" TIMESTAMP(3),
    "extractionSource" TEXT,
    "extractedAmount" DECIMAL(12,2),
    "extractedDueDate" TIMESTAMP(3),
    "extractedPeriod" TEXT,
    "paymentProvider" TEXT,
    "paymentLinkUrl" TEXT,
    "paymentExternalRef" TEXT,
    "paymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDeliveryLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "obligationId" TEXT,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReminder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "obligationId" TEXT,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'both',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "MessageTemplate_workspaceId_idx" ON "MessageTemplate"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_workspaceId_event_tone_channel_key" ON "MessageTemplate"("workspaceId", "event", "tone", "channel");

-- CreateIndex
CREATE INDEX "Property_workspaceId_idx" ON "Property"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_tenantToken_key" ON "Unit"("tenantToken");

-- CreateIndex
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");

-- CreateIndex
CREATE INDEX "ContractHistory_unitId_idx" ON "ContractHistory"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantContact_unitId_key" ON "TenantContact"("unitId");

-- CreateIndex
CREATE INDEX "ObligationTemplate_unitId_idx" ON "ObligationTemplate"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationTemplate_unitId_type_key" ON "ObligationTemplate"("unitId", "type");

-- CreateIndex
CREATE INDEX "Obligation_unitId_dueDate_idx" ON "Obligation"("unitId", "dueDate");

-- CreateIndex
CREATE INDEX "Obligation_status_dueDate_idx" ON "Obligation"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Obligation_templateId_dueMonth_key" ON "Obligation"("templateId", "dueMonth");

-- CreateIndex
CREATE INDEX "NotificationLog_obligationId_idx" ON "NotificationLog"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_obligationId_type_key" ON "NotificationLog"("obligationId", "type");

-- CreateIndex
CREATE INDEX "MessageDeliveryLog_workspaceId_createdAt_idx" ON "MessageDeliveryLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageDeliveryLog_obligationId_createdAt_idx" ON "MessageDeliveryLog"("obligationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_phone_createdAt_idx" ON "ChatMessage"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "Claim_unitId_status_idx" ON "Claim"("unitId", "status");

-- CreateIndex
CREATE INDEX "Claim_status_createdAt_idx" ON "Claim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledReminder_status_sendAt_idx" ON "ScheduledReminder"("status", "sendAt");

-- CreateIndex
CREATE INDEX "ScheduledReminder_workspaceId_idx" ON "ScheduledReminder"("workspaceId");

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractHistory" ADD CONSTRAINT "ContractHistory_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantContact" ADD CONSTRAINT "TenantContact_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationTemplate" ADD CONSTRAINT "ObligationTemplate_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ObligationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDeliveryLog" ADD CONSTRAINT "MessageDeliveryLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

