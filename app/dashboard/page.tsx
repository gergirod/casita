import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireOwner } from "@/lib/auth";
import { getOwnerDashboardOverview } from "@/lib/dashboard-data";
import { CasitaLogo, CasitaLockup } from "@/components/casita-logo";
import { WhatsAppConnectBanner } from "@/components/whatsapp-connect-banner";
import { prisma } from "@/lib/prisma";

const CASITA_WA_NUMBER = process.env.TWILIO_WHATSAPP_FROM ?? "+14155238886";
const SANDBOX_JOIN_CODE = process.env.TWILIO_SANDBOX_JOIN_CODE ?? undefined;

export default async function DashboardPage() {
  const owner = await requireOwner();
  let workspaces: Awaited<ReturnType<typeof getOwnerDashboardOverview>> = [];

  try {
    workspaces = await getOwnerDashboardOverview(owner.id);
  } catch (error) {
    if (!isDatabaseConnectivityError(error)) throw error;
    return <DatabaseErrorState />;
  }

  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { ownerId: owner.id },
    select: { phone: true },
  });
  const hasWhatsApp = !!ownerProfile?.phone;

  const summary = workspaces.reduce(
    (acc, ws) => {
      acc.workspaces += 1;
      acc.units += ws.unitsCount;
      acc.pending += ws.counters.pending;
      acc.overdue += ws.counters.overdue;
      return acc;
    },
    { workspaces: 0, units: 0, pending: 0, overdue: 0 }
  );

  return (
    <main style={{ minHeight: "100vh", background: "#f2f2f7" }}>
      {/* Nav */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.25rem",
          height: "56px",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <CasitaLockup size={24} variant="nav" />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link
            href="/onboarding"
            style={{
              background: "#059669",
              color: "#fff",
              fontSize: "0.82rem",
              fontWeight: 600,
              padding: "0.4rem 0.9rem",
              borderRadius: "8px",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            + Nueva casita
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1.25rem" }}>
        {/* WhatsApp onboarding banner — shown until the owner connects their phone */}
        {!hasWhatsApp && (
          <WhatsAppConnectBanner
            casitaWhatsAppNumber={CASITA_WA_NUMBER}
            sandboxJoinCode={SANDBOX_JOIN_CODE}
          />
        )}

        {/* Title + summary */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{
            fontSize: "1.9rem",
            fontWeight: 800,
            color: "#1c1c1e",
            letterSpacing: "-0.04em",
            margin: "0 0 0.25rem",
          }}>
            Tus casitas
          </h1>
          {workspaces.length > 0 && (
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#6b7280", letterSpacing: "-0.01em" }}>
              {summary.workspaces} {summary.workspaces === 1 ? "casita" : "casitas"}
              {" · "}{summary.units} {summary.units === 1 ? "unidad" : "unidades"}
              {summary.overdue > 0 && (
                <span style={{ color: "#dc2626", fontWeight: 600 }}> · {summary.overdue} vencida{summary.overdue === 1 ? "" : "s"}</span>
              )}
              {summary.pending > 0 && summary.overdue === 0 && (
                <span style={{ color: "#d97706", fontWeight: 600 }}> · {summary.pending} pendiente{summary.pending === 1 ? "" : "s"}</span>
              )}
            </p>
          )}
        </div>

        {/* Cards */}
        {workspaces.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {workspaces.map((ws) => <WorkspaceCard key={ws.id} workspace={ws} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function isDatabaseConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /P1001|Can't reach database server|Tenant or user not found|ENOTFOUND|ECONNREFUSED|database server/i.test(error.message);
}

type Workspace = {
  id: string;
  name: string;
  currency: string;
  propertiesCount: number;
  unitsCount: number;
  counters: { pending: number; overdue: number; verified: number; total: number; proofUploaded: number };
};

function WorkspaceCard({ workspace: ws }: { workspace: Workspace }) {
  const isUrgent = ws.counters.overdue > 0;
  const hasWarning = !isUrgent && (ws.counters.proofUploaded > 0);

  const badge = isUrgent
    ? { label: `${ws.counters.overdue} vencida${ws.counters.overdue === 1 ? "" : "s"}`, bg: "#fef2f2", color: "#dc2626", dot: "#dc2626" }
    : hasWarning
      ? { label: "Requiere atención", bg: "#fffbeb", color: "#b45309", dot: "#d97706" }
      : { label: "En orden", bg: "#ecfdf5", color: "#059669", dot: "#059669" };

  return (
    <Link href={`/dashboard/${ws.id}`} style={{ textDecoration: "none" }}>
      <article style={{
        background: "#ffffff",
        borderRadius: "18px",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        cursor: "pointer",
      }}>
        {/* Card header */}
        <div style={{
          padding: "1.1rem 1.25rem 1rem",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}>
          <div>
            <h2 style={{
              margin: "0 0 3px",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#1c1c1e",
              letterSpacing: "-0.03em",
            }}>
              {ws.name}
            </h2>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#8e8e93", letterSpacing: "-0.01em" }}>
              {ws.currency} · {ws.propertiesCount} {ws.propertiesCount === 1 ? "propiedad" : "propiedades"} · {ws.unitsCount} {ws.unitsCount === 1 ? "unidad" : "unidades"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, paddingTop: "2px" }}>
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: badge.color,
              background: badge.bg,
              padding: "0.22rem 0.6rem",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: badge.dot, flexShrink: 0 }} />
              {badge.label}
            </span>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M1 1l4 4-4 4" stroke="#c7c7cc" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          padding: "1rem 1.25rem",
        }}>
          <StatBlock value={ws.counters.overdue} label="Vencidas" activeColor="#dc2626" />
          <StatBlock value={ws.counters.proofUploaded} label="A verificar" activeColor="#d97706" />
          <StatBlock value={ws.counters.pending} label="Pendientes" activeColor="#374151" />
          <StatBlock value={ws.counters.verified} label="Verificadas" activeColor="#059669" />
        </div>
      </article>
    </Link>
  );
}

function StatBlock({ value, label, activeColor }: { value: number; label: string; activeColor: string }) {
  const isActive = value > 0;
  return (
    <div style={{ textAlign: "center", padding: "0.1rem 0" }}>
      <p style={{
        margin: "0 0 3px",
        fontSize: "1.6rem",
        fontWeight: 700,
        color: isActive ? activeColor : "#d1d5db",
        letterSpacing: "-0.05em",
        lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{
        margin: 0,
        fontSize: "0.67rem",
        color: "#8e8e93",
        letterSpacing: "-0.005em",
        lineHeight: 1.2,
        fontWeight: 500,
      }}>
        {label}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "20px",
      padding: "3rem 2rem",
      textAlign: "center",
      border: "1px solid rgba(0,0,0,0.06)",
      display: "grid",
      gap: "1.25rem",
      placeItems: "center",
    }}>
      <div style={{
        width: "56px",
        height: "56px",
        borderRadius: "16px",
        background: "#ecfdf5",
        display: "grid",
        placeItems: "center",
      }}>
        <CasitaLogo size={28} variant="nav" />
      </div>
      <div>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.15rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.025em" }}>
          Aún no tenés casitas
        </h2>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "#6b7280", lineHeight: 1.6, maxWidth: "22rem" }}>
          Empezá con el asistente guiado para crear tu primera casita en pocos pasos.
        </p>
      </div>
      <Link
        href="/onboarding"
        style={{
          background: "#059669",
          color: "#fff",
          fontSize: "0.9rem",
          fontWeight: 600,
          padding: "0.65rem 1.5rem",
          borderRadius: "10px",
          textDecoration: "none",
          letterSpacing: "-0.01em",
        }}
      >
        Iniciar setup guiado
      </Link>
    </div>
  );
}

function DatabaseErrorState() {
  return (
    <main style={{ minHeight: "100vh", background: "#f2f2f7" }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.25rem",
        height: "56px",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <CasitaLockup size={24} variant="nav" />
        <SignOutButton />
      </header>
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1.25rem" }}>
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
            Revisá <code>DATABASE_URL</code> en <code>.env.local</code> y usá el string de{" "}
            <strong>Transaction pooler</strong> desde el panel de Supabase.
          </p>
        </div>
      </div>
    </main>
  );
}
