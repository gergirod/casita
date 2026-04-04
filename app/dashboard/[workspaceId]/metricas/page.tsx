import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CasitaLockup } from "@/components/casita-logo";
import { SignOutButton } from "@/components/sign-out-button";
import {
  getOnboardingRate,
  getOwnerWhatsAppActivity,
  getCompleteCycles,
  getTenantSelfServiceRate,
  getAverageCycleTime,
  type OnboardingRate,
  type WhatsAppActivity,
  type CompleteCycles,
  type TenantSelfService,
  type CycleTime,
} from "@/lib/services/validation-metrics";

export default async function MetricasPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const owner = await requireOwner();
  const { workspaceId } = await params;

  // Ownership guard
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: owner.id },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  // Fetch all 5 metrics in parallel
  const [onboarding, whatsapp, cycles, selfService, cycleTime] =
    await Promise.all([
      getOnboardingRate(owner.id),
      getOwnerWhatsAppActivity(owner.id),
      getCompleteCycles(owner.id, workspaceId),
      getTenantSelfServiceRate(owner.id, workspaceId),
      getAverageCycleTime(owner.id, workspaceId),
    ]);

  return (
    <main style={{ minHeight: "100vh", background: "#f2f2f7" }}>
      {/* Nav */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 1.25rem",
          height: "56px",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          gap: "0.75rem",
        }}
      >
        <CasitaLockup size={22} variant="nav" />
        <Link
          href={`/dashboard/${workspaceId}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "0.85rem",
            color: "#059669",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L2 6l4 5" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Volver
        </Link>
        <div style={{ flex: 1 }} />
        <SignOutButton />
      </header>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1.25rem", display: "grid", gap: "1.5rem" }}>

        {/* Header */}
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#1c1c1e",
              letterSpacing: "-0.03em",
              margin: "0 0 0.3rem",
            }}
          >
            Métricas de beta
          </h1>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b7280", lineHeight: 1.5 }}>
            {workspace.name} · Basadas en datos reales del sistema. Sin analytics externo.
          </p>
        </div>

        {/* M1 — Onboarding */}
        <MetricCard
          number={onboarding.total === 0 ? "—" : `${onboarding.complete}/${onboarding.total}`}
          label="Casitas con loop activo"
          rate={onboarding.total === 0 ? null : onboarding.rate}
          tone={rateTone(onboarding.rate, onboarding.total)}
          detail={onboarding.total === 0
            ? "No hay casitas activas aún."
            : `${onboarding.complete} de ${onboarding.total} tienen inquilino registrado, cobro configurado y al menos 1 obligación creada.`}
          footnote="Scope: todas tus casitas · Snapshot actual"
          limitation={null}
        />

        {/* M2 — WhatsApp activity */}
        <MetricCard
          number={`${whatsapp.activeWeeks}/4`}
          label="Semanas activo en WhatsApp"
          rate={null}
          tone={whatsapp.activeWeeks >= 3 ? "success" : whatsapp.activeWeeks >= 1 ? "warning" : "neutral"}
          detail={
            whatsapp.activeWeeks === 0
              ? "No se registraron acciones del owner por WhatsApp en las últimas 4 semanas."
              : whatsapp.lastActivityAt
                ? `Última acción: ${formatDate(whatsapp.lastActivityAt)}.`
                : "Al menos 1 acción registrada en WhatsApp."
          }
          footnote="Scope: todas tus casitas · Ventana: últimas 4 semanas ISO"
          limitation="Solo cuenta acciones que generaron un evento en el sistema (verify, reminder, etc.). Mensajes sin acción no se cuentan."
        />

        {/* M3 — Complete cycles */}
        <MetricCard
          number={cycles.verifiedTotal === 0 ? "—" : `${cycles.completeCycles}/${cycles.verifiedTotal}`}
          label="Ciclos completos trazados"
          rate={cycles.verifiedTotal === 0 ? null : cycles.rate}
          tone={rateTone(cycles.rate, cycles.verifiedTotal)}
          detail={cycles.verifiedTotal === 0
            ? "Sin ciclos verificados aún. Empezará a llenarse cuando el primer cobro llegue a 'verificado'."
            : `${cycles.completeCycles} de ${cycles.verifiedTotal} cobros verificados tuvieron reminder + comprobante + verificación trazados en el sistema.`}
          footnote="Scope: esta casita · Ventana: últimos 6 meses"
          limitation="Si recordaste al inquilino por fuera del sistema (WA directo, llamada), ese ciclo no se cuenta. Es intencional: mide el uso real del sistema."
        />

        {/* M4 — Tenant self-service */}
        <MetricCard
          number={selfService.totalProofs === 0 ? "—" : `${selfService.rate}%`}
          label="Comprobantes subidos por el inquilino"
          rate={selfService.totalProofs === 0 ? null : selfService.rate}
          tone={rateTone(selfService.rate, selfService.totalProofs)}
          detail={selfService.totalProofs === 0
            ? "Todavía no hay comprobantes registrados en el sistema."
            : `${selfService.tenantProofs} de ${selfService.totalProofs} comprobantes fueron subidos directamente por el inquilino.`}
          footnote="Scope: esta casita · Acumulado"
          limitation={null}
        />

        {/* M5 — Cycle time */}
        <MetricCard
          number={cycleTime.avgDays === null ? "—" : `${cycleTime.avgDays} días`}
          label="Tiempo promedio del ciclo"
          rate={null}
          tone={cycleTimeTone(cycleTime.avgDays)}
          detail={cycleTime.avgDays === null
            ? "Sin datos suficientes aún. Requiere al menos 1 cobro verificado con fecha de pago registrada en los últimos 90 días."
            : `Promedio de ${cycleTime.avgDays} días desde que se crea el cobro hasta que queda verificado (N=${cycleTime.sampleSize}).${cycleTime.pendingVerification > 0 ? ` Hay ${cycleTime.pendingVerification} comprobante${cycleTime.pendingVerification === 1 ? "" : "s"} esperando verificación del owner.` : ""}`}
          footnote="Scope: esta casita · Ventana: últimos 90 días"
          limitation="Solo incluye cobros con fecha de pago registrada. Cobros verificados sin paidAt no entran en el cálculo."
        />

        {/* Footer */}
        <p style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
          Estas métricas se calculan en tiempo real sobre los datos del sistema.
          <br />
          No hay analytics externo. No se envían datos a terceros.
        </p>
      </div>
    </main>
  );
}

// ─── Tone helpers ─────────────────────────────────────────────────────────────

type Tone = "success" | "warning" | "neutral" | "danger";

function rateTone(rate: number, denominator: number): Tone {
  if (denominator === 0) return "neutral";
  if (rate >= 70) return "success";
  if (rate >= 40) return "warning";
  return "danger";
}

function cycleTimeTone(avgDays: number | null): Tone {
  if (avgDays === null) return "neutral";
  if (avgDays <= 5)  return "success";
  if (avgDays <= 10) return "warning";
  return "danger";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── MetricCard component ─────────────────────────────────────────────────────

const TONE_STYLES: Record<Tone, { border: string; badge: string; text: string; dot: string }> = {
  success: { border: "#a7f3d0", badge: "#ecfdf5", text: "#059669", dot: "#059669" },
  warning: { border: "#fed7aa", badge: "#fffbeb", text: "#b45309", dot: "#d97706" },
  danger:  { border: "#fca5a5", badge: "#fef2f2", text: "#dc2626", dot: "#dc2626" },
  neutral: { border: "#e5e7eb", badge: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
};

function MetricCard({
  number,
  label,
  rate,
  tone,
  detail,
  footnote,
  limitation,
}: {
  number: string;
  label: string;
  rate: number | null;
  tone: Tone;
  detail: string;
  footnote: string;
  limitation: string | null;
}) {
  const s = TONE_STYLES[tone];

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        border: `1.5px solid ${s.border}`,
        padding: "1.25rem 1.35rem",
        display: "grid",
        gap: "0.75rem",
      }}
    >
      {/* Top row: number + optional rate badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "2rem",
              fontWeight: 800,
              color: "#1c1c1e",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            {number}
          </p>
          <p
            style={{
              margin: "0.3rem 0 0",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#374151",
              letterSpacing: "-0.01em",
            }}
          >
            {label}
          </p>
        </div>

        {rate !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: s.badge,
              border: `1px solid ${s.border}`,
              borderRadius: "999px",
              padding: "0.3rem 0.75rem",
              flexShrink: 0,
            }}
          >
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: s.text }}>{rate}%</span>
          </div>
        )}

        {rate === null && (
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: s.dot,
              flexShrink: 0,
              marginTop: "6px",
            }}
          />
        )}
      </div>

      {/* Detail text */}
      <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", lineHeight: 1.6 }}>
        {detail}
      </p>

      {/* Limitation note */}
      {limitation && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#9ca3af", lineHeight: 1.5, fontStyle: "italic" }}>
          {limitation}
        </p>
      )}

      {/* Footnote */}
      <p style={{ margin: 0, fontSize: "0.72rem", color: "#c7c7cc", letterSpacing: "0.01em" }}>
        {footnote}
      </p>
    </div>
  );
}
