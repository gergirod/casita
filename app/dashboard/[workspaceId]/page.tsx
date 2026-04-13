import Link from "next/link";
import { notFound } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { requireOwner } from "@/lib/auth";
import { getWorkspaceDetail, getRecentActivity } from "@/lib/dashboard-data";
import { CasitaLockup } from "@/components/casita-logo";
import { TenantLinkCopier } from "@/components/tenant-link-copier";
import { UnitEditor } from "@/components/unit-editor";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { ClaimsPanel } from "@/components/claims-panel";
import { ProofPendingPanel } from "@/components/proof-pending-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { prisma } from "@/lib/prisma";
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const owner = await requireOwner();
  const { workspaceId } = await params;
  let workspaceData: Awaited<ReturnType<typeof getWorkspaceDetail>>;

  try {
    workspaceData = await getWorkspaceDetail(owner.id, workspaceId);
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
    return <DatabaseErrorState />;
  }

  const { workspace, counters, pastRentals, claims } = workspaceData;

  /* Email is now account-level — read from OwnerProfile */
  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { ownerId: owner.id },
    select: { emailAddress: true },
  });
  const emailConnected = !!ownerProfile?.emailAddress;

  // Fetched after the main workspace data — never throws (returns [] on miss)
  const recentActivity = workspace
    ? await getRecentActivity(owner.id, workspaceId, 15)
    : [];

  if (!workspace) notFound();

  /* Active unit — isActive:true, most recent first */
  const unit = workspace.properties[0]?.units.find((u) => u.isActive) ?? null;

  const allObligations = workspace.properties.flatMap((p) =>
    p.units.flatMap((u) =>
      u.obligations.map((o) => ({
        ...o,
        unitIdentifier:  u.identifier,
        originalBillUrl: o.originalBillUrl ?? null,
        tenantName:      u.tenantContact?.fullName ?? null,
        tenantWhatsapp:  u.tenantContact?.whatsapp ?? null,
        tenantToken:     u.tenantToken,
        propertyName:    p.name,
      }))
    )
  );

  /* Unit-level obligations for the month navigator in UnitEditor */
  const unitObligations = unit ? allObligations : [];

  const overdue = allObligations.filter((o) => o.status === "overdue");
  const proofPending = allObligations.filter((o) => o.status === "proof_uploaded");
  const pending = allObligations.filter((o) => o.status === "pending");
  const upcoming = allObligations.filter((o) => o.status === "upcoming");
  const focusText =
    overdue.length > 0
      ? `Hoy tu prioridad es resolver ${overdue.length} vencida${overdue.length === 1 ? "" : "s"}.`
      : proofPending.length > 0
        ? `Tenés ${proofPending.length} comprobante${proofPending.length === 1 ? "" : "s"} para verificar y cerrar seguimiento.`
        : pending.length > 0
          ? `${pending.length} cobro${pending.length === 1 ? "" : "s"} pendiente${pending.length === 1 ? "" : "s"} sin atraso por ahora.`
          : "Sin pendientes críticos por ahora. Buen momento para adelantarte a próximos vencimientos.";

  const allZero = counters!.overdue === 0 && counters!.proofUploaded === 0 && counters!.pending === 0;

  const leaseEndLabel = unit?.leaseEndDate
    ? new Date(unit.leaseEndDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  const leaseExpiringSoon = unit?.leaseEndDate
    ? (new Date(unit.leaseEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 60
    : false;

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
          href="/dashboard"
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
        <Link
          href="/dashboard/settings"
          style={{
            fontSize: "0.8rem",
            color: "#6b7280",
            textDecoration: "none",
            fontWeight: 500,
            padding: "0.3rem 0.6rem",
          }}
        >
          Ajustes
        </Link>
        <SignOutButton />
      </header>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1.25rem", display: "grid", gap: "2rem" }}>

        {/* Casita heading */}
        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.04em", margin: "0 0 0.25rem" }}>
                {workspace.name}
              </h1>
              {/* Tenant + lease info as subtitle — no property/unit jargon */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                {unit?.tenantContact && (
                  <span style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 500, letterSpacing: "-0.01em" }}>
                    {unit.tenantContact.fullName}
                  </span>
                )}
                {unit?.tenantContact && (leaseEndLabel || workspace.currency) && (
                  <span style={{ fontSize: "0.75rem", color: "#c7c7cc" }}>·</span>
                )}
                {workspace.currency && (
                  <span style={{ fontSize: "0.82rem", color: "#8e8e93", letterSpacing: "-0.01em" }}>{workspace.currency}</span>
                )}
                {leaseEndLabel && (
                  <>
                    <span style={{ fontSize: "0.75rem", color: "#c7c7cc" }}>·</span>
                    <span style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: leaseExpiringSoon ? "#b45309" : "#8e8e93",
                      background: leaseExpiringSoon ? "#fffbeb" : "transparent",
                      padding: leaseExpiringSoon ? "0.05rem 0.4rem" : undefined,
                      borderRadius: leaseExpiringSoon ? "5px" : undefined,
                    }}>
                      Vence {leaseEndLabel}{leaseExpiringSoon ? " ⚠" : ""}
                    </span>
                  </>
                )}
                {unit && (
                  <>
                    <span style={{ fontSize: "0.75rem", color: "#c7c7cc" }}>·</span>
                    <TenantLinkCopier token={unit.tenantToken} />
                  </>
                )}
              </div>
            </div>
            <WorkspaceSettings
              workspaceId={workspace.id}
              workspaceName={workspace.name}
              whatsappEnabled={workspace.whatsappEnabled}
              ownerPhone={workspace.ownerPhone ?? null}
              pastRentals={pastRentals}
              unit={unit ? {
                id: unit.id,
                contractUrl: unit.contractUrl ?? null,
                leaseEndDate: unit.leaseEndDate ?? null,
                contractHistory: (unit.contractHistory ?? []).map((c: { id: string; url: string; uploadedAt: string }) => ({
                  id: c.id,
                  url: c.url,
                  uploadedAt: c.uploadedAt,
                })),
                tenantContact: unit.tenantContact
                  ? { id: unit.tenantContact.id, fullName: unit.tenantContact.fullName, email: unit.tenantContact.email, whatsapp: unit.tenantContact.whatsapp }
                  : null,
              } : null}
            />
          </div>

          {/* Status badges — color only when value > 0 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            {allZero ? (
              <span style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#059669",
                background: "#ecfdf5",
                padding: "0.3rem 0.7rem",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#059669" }} />
                Todo en orden
              </span>
            ) : (
              <>
                {counters!.overdue > 0 && <CounterBadge label="Vencidas" value={counters!.overdue} tone="danger" />}
                {counters!.proofUploaded > 0 && <CounterBadge label="A verificar" value={counters!.proofUploaded} tone="warning" />}
                {counters!.pending > 0 && <CounterBadge label="Pendientes" value={counters!.pending} tone="neutral" />}
                {counters!.verified > 0 && <CounterBadge label="Verificadas" value={counters!.verified} tone="success" />}
              </>
            )}
          </div>

          {/* No-email warning — shown when tenant exists but has no email */}
          {unit?.tenantContact && !unit.tenantContact.email && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0.75rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              fontSize: "0.76rem",
              color: "#92400e",
              fontWeight: 500,
            }}>
              <span>⚠️</span>
              <span>
                <strong>{unit.tenantContact.fullName}</strong> no tiene email — los recordatorios de pago no le van a llegar.{" "}
                Agregalo en <strong>Configuración</strong> (ícono ⚙️ arriba a la derecha).
              </span>
            </div>
          )}

          {/* Focus text — only when there's something to say */}
          {!allZero && (
            <p style={{
              margin: 0,
              fontSize: "0.82rem",
              color: overdue.length > 0 ? "#dc2626" : "#6b7280",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              background: overdue.length > 0 ? "#fef2f2" : "transparent",
              borderRadius: overdue.length > 0 ? "10px" : "0",
              padding: overdue.length > 0 ? "0.5rem 0.75rem" : "0",
            }}>
              {focusText}
            </p>
          )}
        </div>

        {/* Comprobantes a verificar — surface all proof_uploaded obligations at a glance */}
        {proofPending.length > 0 && (
          <ProofPendingPanel
            items={proofPending.map((o) => ({
              id: o.id,
              title: o.title,
              amount: Number(o.amount).toLocaleString("es-AR"),
              currency: workspace.currency,
              dueDate: new Date(o.dueDate as unknown as string).toISOString(),
              proofUrl: o.proofUrl,
              tenantName: o.tenantName,
              propertyName: o.propertyName,
            }))}
          />
        )}

        {/* Cobros — vista mensual navegable */}
        {unit ? (
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}>
            <UnitEditor
              unitId={unit.id}
              workspaceId={workspace.id}
              emailConnected={emailConnected}
              templates={unit.obligationTemplates}
              obligations={unitObligations}
              leaseEndDate={unit.leaseEndDate ?? null}
              unitCreatedAt={unit.createdAt}
              tenantName={unit.tenantContact?.fullName ?? null}
            />
          </div>
        ) : (
          <EmptyCasitaState workspaceId={workspace.id} />
        )}

        {/* Reclamos */}
        {claims.length > 0 && <ClaimsPanel claims={claims} />}

        {/* Actividad reciente — mission control / historial operativo */}
        <ActivityFeed items={recentActivity} />

        {/* Beta validation metrics — subtle footer link */}
        <div style={{ textAlign: "center", paddingBottom: "0.5rem" }}>
          <Link
            href={`/dashboard/${workspaceId}/metricas`}
            style={{
              fontSize: "0.75rem",
              color: "#9ca3af",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            Ver métricas de beta →
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ── Empty state: no active rental ─────────────────────────────── */
function EmptyCasitaState({ workspaceId }: { workspaceId: string }) {
  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "16px",
      border: "1px solid rgba(0,0,0,0.07)",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      padding: "2rem 1.5rem",
      textAlign: "center",
      display: "grid",
      gap: "1rem",
      justifyItems: "center",
    }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="#059669" strokeWidth="1.8" strokeLinejoin="round"/>
          <path d="M9 21V12h6v9" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>
          Casita libre
        </p>
        <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#6b7280", lineHeight: 1.5 }}>
          No hay un alquiler activo. Cuando llegue un nuevo inquilino, iniciá el alquiler desde acá.
        </p>
      </div>
      <Link
        href={`/dashboard/${workspaceId}/nuevo-alquiler`}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          background: "#059669", color: "#fff", textDecoration: "none",
          fontWeight: 700, fontSize: "0.9rem", borderRadius: "12px",
          padding: "0.75rem 1.4rem", letterSpacing: "-0.01em",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Iniciar nuevo alquiler
      </Link>
    </div>
  );
}

function isDatabaseConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /P1001|Can't reach database server|Tenant or user not found|ENOTFOUND|ECONNREFUSED|database server/i.test(error.message);
}

function DatabaseErrorState() {
  return (
    <main style={{ minHeight: "100vh", background: "#f2f2f7" }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        padding: "0 1.25rem",
        height: "56px",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        gap: "0.75rem",
      }}>
        <CasitaLockup size={22} variant="nav" />
        <Link href="/dashboard" style={{ fontSize: "0.85rem", color: "#059669", textDecoration: "none" }}>← Volver</Link>
        <div style={{ flex: 1 }} />
        <SignOutButton />
      </header>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1.25rem" }}>
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid rgba(0,0,0,0.06)",
          display: "grid",
          gap: "0.65rem",
        }}>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>
            No pudimos conectar con Supabase
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.88rem", lineHeight: 1.6 }}>
            Revisá <code>DATABASE_URL</code> en <code>.env.local</code> y pegá el valor vigente de{" "}
            <strong>Transaction pooler</strong> desde tu proyecto en Supabase.
          </p>
        </div>
      </div>
    </main>
  );
}


type ToneKey = "neutral" | "warning" | "danger" | "success";

function CounterBadge({ label, value, tone }: { label: string; value: number; tone: ToneKey }) {
  const styles: Record<ToneKey, { bg: string; dot: string; color: string }> = {
    danger:  { bg: "#fef2f2", dot: "#dc2626", color: "#dc2626" },
    warning: { bg: "#fffbeb", dot: "#d97706", color: "#b45309" },
    success: { bg: "#ecfdf5", dot: "#059669", color: "#059669" },
    neutral: { bg: "#f3f4f6", dot: "#9ca3af", color: "#374151" },
  };
  const s = styles[tone];

  return (
    <div style={{
      borderRadius: "999px",
      background: s.bg,
      padding: "0.28rem 0.65rem",
      display: "flex",
      alignItems: "center",
      gap: "5px",
    }}>
      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: s.color, letterSpacing: "-0.01em" }}>
        {value} {label}
      </span>
    </div>
  );
}
