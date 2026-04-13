/**
 * agent-checklist.ts
 *
 * Single source of truth for prerequisite rules the bot must follow
 * before performing any action that touches bills, templates, or units.
 *
 * These rules are:
 *   1. Injected into the agent system prompt so the LLM understands the flow.
 *   2. Evaluated at runtime via `checkSetup()` which the agent calls as a tool.
 *
 * To add a new rule: add an entry to CHECKLIST_RULES and implement its
 * `check` function. No other file needs to change.
 */

import { prisma } from "@/lib/prisma";
import { ObligationType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChecklistStatus = "ok" | "missing" | "incomplete";

export type ChecklistResult = {
  id: string;
  label: string;
  status: ChecklistStatus;
  /** Short message for the owner when something is missing/incomplete */
  message?: string;
  /** Suggested next action for the AI to take */
  next_action?: string;
  /** Any relevant IDs or data the AI needs */
  data?: Record<string, unknown>;
};

export type SetupReport = {
  action: string;
  ready: boolean;
  checks: ChecklistResult[];
};

// ─── Rules ────────────────────────────────────────────────────────────────────

type Rule = {
  id: string;
  label: string;
  /** actions this rule applies to */
  triggers: string[];
  check: (workspaceId: string) => Promise<ChecklistResult>;
};

const RULES: Rule[] = [
  // ── At least one active unit ─────────────────────────────────────────────
  {
    id: "has_unit",
    label: "Unidad activa configurada",
    triggers: ["expensas", "luz", "gas", "agua", "internet", "factura", "cobro"],
    check: async (wId) => {
      const count = await prisma.unit.count({
        where: { property: { workspaceId: wId }, isActive: true },
      });
      if (count === 0) {
        return {
          id: "has_unit",
          label: "Unidad activa configurada",
          status: "missing",
          message: "No tenés ninguna casita/unidad activa todavía.",
          next_action: "Guiar al owner para crear una propiedad y unidad desde el dashboard antes de continuar.",
        };
      }
      return { id: "has_unit", label: "Unidad activa configurada", status: "ok" };
    },
  },

  // ── Expensas: template exists ─────────────────────────────────────────────
  {
    id: "expensas_template",
    label: "Cobro recurrente de expensas creado",
    triggers: ["expensas"],
    check: async (wId) => {
      const templates = await prisma.obligationTemplate.findMany({
        where: {
          unit: { property: { workspaceId: wId } },
          type: "expensas",
          isActive: true,
        },
        select: { id: true, title: true, customSenderPattern: true, unit: { select: { identifier: true, property: { select: { name: true } } } } },
      });
      if (templates.length === 0) {
        const units = await prisma.unit.findMany({
          where: { property: { workspaceId: wId }, isActive: true },
          select: { id: true, identifier: true, property: { select: { name: true } } },
        });
        return {
          id: "expensas_template",
          label: "Cobro recurrente de expensas creado",
          status: "missing",
          message: "No tenés ningún cobro recurrente de expensas configurado en tu casita.",
          next_action: "Preguntale al owner: ¿en cuál unidad querés crear el cobro de expensas? ¿Cuánto es el monto aproximado (podés poner 0 si varía)? ¿Cuándo vence normalmente (ej: el 10 de cada mes)?",
          data: {
            unidades_disponibles: units.map(u => ({ id: u.id, label: `${u.property.name} — ${u.identifier}` })),
          },
        };
      }
      // Check which have sender configured
      const withSender = templates.filter(t => t.customSenderPattern);
      const withoutSender = templates.filter(t => !t.customSenderPattern);
      if (withoutSender.length > 0 && withSender.length === 0) {
        return {
          id: "expensas_template",
          label: "Cobro recurrente de expensas creado",
          status: "incomplete",
          message: `Tenés ${templates.length} cobro(s) de expensas pero ninguno tiene la administradora configurada.`,
          next_action: "Preguntarle: ¿desde qué email o nombre te manda las liquidaciones la administración del edificio? (Ej: simplesolutions.com.ar, consorcio@edificio.com)",
          data: {
            templates: templates.map(t => ({ id: t.id, title: t.title, unidad: `${t.unit.property.name} — ${t.unit.identifier}` })),
          },
        };
      }
      return {
        id: "expensas_template",
        label: "Cobro recurrente de expensas creado",
        status: "ok",
        data: {
          templates_con_remitente: withSender.map(t => ({
            id: t.id,
            title: t.title,
            sender: t.customSenderPattern,
            unidad: `${t.unit.property.name} — ${t.unit.identifier}`,
          })),
          templates_sin_remitente: withoutSender.map(t => ({
            id: t.id,
            title: t.title,
            unidad: `${t.unit.property.name} — ${t.unit.identifier}`,
          })),
        },
      };
    },
  },

  // ── Utility services: template exists ────────────────────────────────────
  {
    id: "service_template",
    label: "Cobro recurrente del servicio creado",
    triggers: ["luz", "gas", "agua", "internet"],
    check: async (wId) => {
      // Map trigger words to ObligationTemplate types
      // Called per-action so we check all possible service types together
      const types = ["electricity", "gas", "water", "internet"] as const;
      const templates = await prisma.obligationTemplate.findMany({
        where: {
          unit: { property: { workspaceId: wId } },
          type: { in: types as unknown as ObligationType[] },
          isActive: true,
        },
        select: { id: true, title: true, type: true, unit: { select: { identifier: true, property: { select: { name: true } } } } },
      });
      if (templates.length === 0) {
        return {
          id: "service_template",
          label: "Cobro recurrente del servicio creado",
          status: "missing",
          message: "No tenés cobros recurrentes de servicios (luz/gas/agua/internet) configurados.",
          next_action: "Si el owner quiere subir la factura, ofrecerle crear el cobro recurrente del servicio primero. Si sólo quiere verla, podés continuar y luego sugerir crear el cobro.",
        };
      }
      return {
        id: "service_template",
        label: "Cobro recurrente del servicio creado",
        status: "ok",
        data: {
          templates: templates.map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            unidad: `${t.unit.property.name} — ${t.unit.identifier}`,
          })),
        },
      };
    },
  },

  // ── Email connected ───────────────────────────────────────────────────────
  {
    id: "email_connected",
    label: "Email conectado",
    triggers: ["expensas", "luz", "gas", "agua", "internet", "factura"],
    check: async (wId) => {
      const ws = await prisma.workspace.findUnique({ where: { id: wId }, select: { ownerId: true } });
      if (!ws) return { id: "email_connected", label: "Email conectado", status: "missing", message: "Workspace no encontrado." };
      const profile = await prisma.ownerProfile.findUnique({
        where: { ownerId: ws.ownerId },
        select: { emailAddress: true, emailConnectedAt: true },
      });
      if (!profile?.emailConnectedAt) {
        return {
          id: "email_connected",
          label: "Email conectado",
          status: "missing",
          message: "No tenés email conectado.",
          next_action: "Decile al owner que conecte su Gmail o Outlook desde Ajustes para poder buscar facturas automáticamente.",
        };
      }
      return {
        id: "email_connected",
        label: "Email conectado",
        status: "ok",
        data: { email: profile.emailAddress },
      };
    },
  },
];

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Evaluate all prerequisite rules for a given action keyword.
 * Returns a structured report the AI can act on.
 *
 * @param action  e.g. "expensas", "luz", "factura"
 * @param workspaceId
 */
export async function checkSetup(action: string, workspaceId: string): Promise<SetupReport> {
  const lower = action.toLowerCase();
  const relevantRules = RULES.filter(r => r.triggers.some(t => lower.includes(t)));

  // Deduplicate by id (a rule may match multiple triggers)
  const seen = new Set<string>();
  const unique = relevantRules.filter(r => !seen.has(r.id) && seen.add(r.id));

  const checks = await Promise.all(unique.map(r => r.check(workspaceId)));
  const ready = checks.every(c => c.status === "ok");

  return { action, ready, checks };
}

// ─── System prompt fragment ───────────────────────────────────────────────────

/**
 * Human-readable checklist injected into the agent's system prompt.
 * The AI reads this and knows the flow WITHOUT needing hardcoded procedural checks.
 */
export const AGENT_CHECKLIST_PROMPT = `
## Checklist obligatorio antes de actuar

Antes de buscar o subir cualquier factura/cobro, SIEMPRE llamá a la tool \`check_setup\` con la acción que el owner quiere hacer (ej: "expensas", "luz", "gas").

La tool te devuelve el estado real de cada prerequisito. Seguí el orden:

### Para expensas:
1. ✅ ¿Hay unidad activa? → si no: guiar para crearla en el dashboard
2. ✅ ¿Hay cobro recurrente de expensas creado? → si no: crear con el owner (preguntar unidad, monto, vencimiento)
3. ✅ ¿El cobro tiene administradora configurada? → si no: preguntar "¿desde qué email o dominio te mandan las liquidaciones?" — si el owner da solo un nombre (ej "Venice Tigre"), preguntá si tiene el dominio exacto del mail (ej: simplesolutions.com.ar). Si no lo sabe, usá el nombre pero avisale que podría no encontrar nada si el nombre no coincide exactamente.
4. ✅ ¿Hay email conectado? → si no: derivar a Ajustes
5. ✅ Buscar con fetch_bills_from_email → mostrar resultado → preguntar antes de subir

### Para servicios (luz/gas/agua/internet):
1. ✅ ¿Hay unidad activa? → si no: guiar para crearla
2. ✅ ¿Hay email conectado? → si no: derivar a Ajustes
3. ✅ Buscar con fetch_bills_from_email
4. ✅ ¿Hay cobro recurrente del servicio? → si no: "Encontré la factura pero para subirla necesitás crear el cobro recurrente. ¿Lo hacemos?"
5. ✅ Subir vinculada al template (usando template_id)

### Loop de refinamiento (MUY IMPORTANTE):
Si fetch_bills_from_email no encuentra facturas con señales financieras claras:
1. Llamá list_recent_emails con el mismo remitente
2. Mostrá la lista numerada al owner: "Encontré estos emails de [remitente], ¿cuál es la liquidación? (decime el número)"
3. El owner elige → llamá process_specific_email con ese message_id
4. Si el owner no reconoce ninguno, preguntá: "¿Recordás alguna palabra del asunto del email de expensas? ¿O sabés desde qué email exacto viene?" y refiná la búsqueda.
5. NUNCA te rindas en el primer intento fallido — siempre intentá el loop.

### Regla general:
- NUNCA subas una factura sin confirmar con el owner primero.
- NUNCA saltes un paso del checklist aunque el owner lo pida directamente.
- Si falta un prerequisito, completalo en orden antes de avanzar.
- Un cobro "huérfano" (sin template) es inútil — siempre vinculá.
`.trim();
