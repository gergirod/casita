import { prisma } from "@/lib/prisma";

export async function logDelivery(input: {
  workspaceId: string;
  obligationId?: string | null;
  channel: "email" | "whatsapp";
  event: string;
  to: string;
  status: "sent" | "skipped" | "failed";
  provider?: string | null;
  error?: string | null;
}) {
  await prisma.messageDeliveryLog.create({
    data: {
      workspaceId: input.workspaceId,
      obligationId: input.obligationId ?? null,
      channel: input.channel,
      event: input.event,
      to: input.to,
      status: input.status,
      provider: input.provider ?? null,
      error: input.error ?? null,
    },
  });
}
