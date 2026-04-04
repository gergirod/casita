import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type ActivityAction =
  | "obligation.created"
  | "obligation.updated"
  | "reminder.sent"
  | "proof.uploaded"
  | "payment.verified"
  | "claim.created"
  | "claim.updated";

export type ActivityActorType = "owner" | "tenant" | "system" | "cron";
export type ActivityChannel =
  | "whatsapp"
  | "dashboard"
  | "cron"
  | "api"
  | "webhook";

export interface LogActivityInput {
  workspaceId: string;
  unitId?: string;
  actorType: ActivityActorType;
  actorId?: string; // nullable: omit for system/cron events
  action: ActivityAction;
  entityType?: "obligation" | "claim" | "reminder";
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  channel?: ActivityChannel;
}

/**
 * Write an activity event to the log.
 * Never throws — captures errors internally so callers are never affected.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId: input.workspaceId,
        unitId: input.unitId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
        channel: input.channel ?? null,
      },
    });
  } catch (err) {
    console.error("[activity-log] failed to write event", input.action, err);
  }
}
