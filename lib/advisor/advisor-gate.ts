import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "@/lib/prisma";
import { callAdvisor } from "./advisor-client";
import type { AdvisorInput, AdvisorIntent, AdvisorOutput, WorkspaceSummary } from "./types";

type OwnerContext = { ownerId: string; phone: string };

// ─── Feature flag ────────────────────────────────────────────────

function isAdvisorEnabled(): boolean {
  return process.env.ADVISOR_PILOT_ENABLED === "true";
}

// ─── Gate B: sensitive action heuristic ─────────────────────────
// Only verbs that imply a state-changing action, in common conjugated forms.
// Query-like messages ("resumen", "cuánto", "ver") won't match any of these.
const ACTION_VERB_REGEX =
  /\b(borra[rl]?|elimin[ao]?r?|termin[ao]?r?|cerr[ao]?r?|cambi[ao]?r?|modific[ao]?r?|registr[ao]?r?|agrega[rl]?|cre[ao]?r?|cerrá|borrá|terminá|cambiá|modificá|agregá|creá)\b/i;

function isSensitiveAction(message: string): boolean {
  return ACTION_VERB_REGEX.test(message);
}

function mentionsAnyWorkspace(message: string, workspaces: WorkspaceSummary[]): boolean {
  const lower = message.toLowerCase();
  return workspaces.some((ws) => ws.name.length > 2 && lower.includes(ws.name.toLowerCase()));
}

function hasRecentToolActivity(history: ChatCompletionMessageParam[]): boolean {
  return history.slice(-4).some(
    (m) =>
      m.role === "tool" ||
      (m.role === "assistant" && "tool_calls" in m && Array.isArray(m.tool_calls) && m.tool_calls.length > 0)
  );
}

// ─── Operational context fetcher (Gate A only) ──────────────────

async function fetchOperationalContext(workspaceId: string) {
  const [pendingObligationsCount, activeRemindersCount, proofPendingCount, unit] =
    await Promise.all([
      prisma.obligation.count({
        where: {
          unit: { property: { workspaceId } },
          status: { in: ["pending", "overdue", "reminded"] },
        },
      }),
      prisma.scheduledReminder.count({
        where: { workspaceId, status: "pending" },
      }),
      prisma.obligation.count({
        where: {
          unit: { property: { workspaceId } },
          status: "proof_uploaded",
        },
      }),
      prisma.unit.findFirst({
        where: { property: { workspaceId }, isActive: true },
        select: { tenantContact: { select: { fullName: true } } },
      }),
    ]);

  return {
    pendingObligationsCount,
    activeRemindersCount,
    hasProofPending: proofPendingCount > 0,
    tenantName: unit?.tenantContact?.fullName ?? null,
  };
}

// ─── ActivityLog writer (Gate A only — requires workspaceId) ─────

async function writeActivityLog({
  action,
  workspaceId,
  ownerId,
  intent,
  metadata,
}: {
  action: string;
  workspaceId: string;
  ownerId: string;
  intent: AdvisorIntent;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId,
        actorType: "system",
        actorId: ownerId,
        action,
        entityType: "advisor",
        channel: "whatsapp",
        metadata: { intent, ...metadata },
      },
    });
  } catch (err) {
    console.error("[advisor] ActivityLog write failed:", err);
  }
}

// ─── Stop message formatter ──────────────────────────────────────

function formatStopMessage(output: AdvisorOutput, intent: AdvisorIntent): string {
  const reason =
    output.stopReason?.trim() ||
    "Hay un riesgo potencial en esta operación. Revisala antes de continuar.";

  const hint =
    intent === "ambiguous_multi_workspace"
      ? "Si igual querés continuar, aclará en cuál casita y lo hago."
      : "Si igual querés continuar, repetí el pedido y lo proceso.";

  return `⚠️ ${reason}\n\n${hint}`;
}

// ─── Gate A: tool-level (delete_casita, end_rental) ─────────────

export async function toolAdvisorGate(
  toolName: "delete_casita" | "end_rental",
  args: Record<string, unknown>,
  owner: OwnerContext,
  ctx: { workspaces: WorkspaceSummary[]; ownerMessage: string }
): Promise<{ proceed: boolean; stopMessage?: string }> {
  if (!isAdvisorEnabled()) return { proceed: true };

  const workspaceId = args.workspace_id as string | undefined;
  if (!workspaceId) {
    // No workspace resolved yet — let normal validation handle it
    return { proceed: true };
  }

  const start = Date.now();
  const opCtx = await fetchOperationalContext(workspaceId);

  const input: AdvisorInput = {
    intent: toolName,
    ownerMessage: ctx.ownerMessage,
    workspaces: ctx.workspaces,
    operationalContext: {
      targetWorkspaceId: workspaceId,
      ...opCtx,
    },
  };

  const output = await callAdvisor(input);
  const durationMs = Date.now() - start;

  const logMeta = {
    confidence: output.confidence,
    risks: output.risks,
    recommendation: output.recommendation,
    durationMs,
    fallback: output._fallback ?? false,
  };

  if (output.stop) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "advisor.stopped",
        intent: toolName,
        ownerId: owner.ownerId,
        stopReason: output.stopReason,
        durationMs,
      })
    );
    await writeActivityLog({
      action: "advisor.stopped",
      workspaceId,
      ownerId: owner.ownerId,
      intent: toolName,
      metadata: { ...logMeta, stopReason: output.stopReason },
    });
    return { proceed: false, stopMessage: formatStopMessage(output, toolName) };
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "advisor.consulted",
      intent: toolName,
      ownerId: owner.ownerId,
      stop: false,
      confidence: output.confidence,
      risks: output.risks.length,
      durationMs,
    })
  );
  await writeActivityLog({
    action: "advisor.consulted",
    workspaceId,
    ownerId: owner.ownerId,
    intent: toolName,
    metadata: logMeta,
  });

  return { proceed: true };
}

// ─── Gate B: message-level (ambiguous multi-workspace) ───────────
// Gate B never writes to ActivityLog — no workspaceId available at this stage.

export async function messageAdvisorGate(
  ownerId: string,
  ownerMessage: string,
  workspaces: WorkspaceSummary[],
  recentHistory: ChatCompletionMessageParam[]
): Promise<{ proceed: boolean; stopMessage?: string }> {
  if (!isAdvisorEnabled()) return { proceed: true };

  // All 5 conditions must hold
  if (workspaces.length < 2) return { proceed: true };
  if (ownerMessage.trim().length <= 15) return { proceed: true };
  if (mentionsAnyWorkspace(ownerMessage, workspaces)) return { proceed: true };
  if (!isSensitiveAction(ownerMessage)) return { proceed: true };
  if (hasRecentToolActivity(recentHistory)) return { proceed: true };

  const start = Date.now();
  const input: AdvisorInput = {
    intent: "ambiguous_multi_workspace",
    ownerMessage,
    workspaces,
    operationalContext: {},
  };

  const output = await callAdvisor(input);
  const durationMs = Date.now() - start;

  if (output.stop) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "advisor.stopped",
        intent: "ambiguous_multi_workspace",
        ownerId,
        stopReason: output.stopReason,
        durationMs,
      })
    );
    return { proceed: false, stopMessage: formatStopMessage(output, "ambiguous_multi_workspace") };
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "advisor.consulted",
      intent: "ambiguous_multi_workspace",
      ownerId,
      stop: false,
      confidence: output.confidence,
      risks: output.risks.length,
      durationMs,
    })
  );

  return { proceed: true };
}
