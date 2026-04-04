"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ClaimData = {
  id: string;
  description: string;
  status: string;
  source: string;
  createdAt: string;
  resolvedAt: string | null;
  casita: string;
  unit: string;
  tenant: string | null;
};

type Filter = "active" | "resolved" | "all";

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  open:        { label: "Abierto",     bg: "#fef2f2", color: "#dc2626", dot: "#dc2626" },
  in_progress: { label: "En progreso", bg: "#fffbeb", color: "#b45309", dot: "#d97706" },
  resolved:    { label: "Resuelto",    bg: "#ecfdf5", color: "#059669", dot: "#059669" },
};

export function ClaimsPanel({ claims }: { claims: ClaimData[] }) {
  const [filter, setFilter] = useState<Filter>("active");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const activeClaims = claims.filter((c) => c.status !== "resolved");
  const resolvedClaims = claims.filter((c) => c.status === "resolved");

  const filtered =
    filter === "active" ? activeClaims :
    filter === "resolved" ? resolvedClaims :
    claims;

  async function updateStatus(claimId: string, status: string) {
    const res = await fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  if (claims.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "16px",
      border: "1px solid rgba(0,0,0,0.07)",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "1rem 1.25rem 0.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
            Reclamos
          </h3>
          {activeClaims.length > 0 && (
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#dc2626",
              background: "#fef2f2",
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
            }}>
              {activeClaims.length} abierto{activeClaims.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "0.25rem", background: "#f3f4f6", borderRadius: "8px", padding: "2px" }}>
          {([
            { key: "active", label: "Activos" },
            { key: "resolved", label: "Resueltos" },
            { key: "all", label: "Todos" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "6px",
                border: "none",
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                background: filter === key ? "#ffffff" : "transparent",
                color: filter === key ? "#111827" : "#6b7280",
                boxShadow: filter === key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Claims list */}
      <div style={{ padding: "0 0.5rem 0.75rem" }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "1rem",
            textAlign: "center",
            fontSize: "0.82rem",
            color: "#9ca3af",
          }}>
            {filter === "active"
              ? "No hay reclamos abiertos. ¡Todo en orden!"
              : filter === "resolved"
                ? "No hay reclamos resueltos."
                : "No hay reclamos."}
          </div>
        ) : (
          filtered.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              onUpdateStatus={updateStatus}
              isPending={pending}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ClaimRow({
  claim,
  onUpdateStatus,
  isPending,
}: {
  claim: ClaimData;
  onUpdateStatus: (id: string, status: string) => void;
  isPending: boolean;
}) {
  const config = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.open;
  const date = new Date(claim.createdAt).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={{
      padding: "0.85rem 0.75rem",
      borderRadius: "12px",
      background: claim.status === "open" ? "#fffbf5" : "#ffffff",
      border: `1px solid ${claim.status === "open" ? "#fed7aa" : "rgba(0,0,0,0.05)"}`,
      marginBottom: "0.4rem",
      display: "grid",
      gap: "0.5rem",
    }}>
      {/* Top row: tenant + status */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>
            {claim.tenant ?? "Sin inquilino"}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>·</span>
          <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>
            {claim.casita}
          </span>
        </div>
        <span style={{
          fontSize: "0.68rem",
          fontWeight: 600,
          color: config.color,
          background: config.bg,
          padding: "0.15rem 0.5rem",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexShrink: 0,
        }}>
          <span style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: config.dot,
          }} />
          {config.label}
        </span>
      </div>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: "0.85rem",
        color: "#1c1c1e",
        lineHeight: 1.5,
      }}>
        {claim.description}
      </p>

      {/* Bottom row: date + actions */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      }}>
        <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
          {claim.source === "whatsapp" ? "📱 " : "🌐 "}{date}
        </span>

        {claim.status !== "resolved" && (
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {claim.status === "open" && (
              <button
                disabled={isPending}
                onClick={() => onUpdateStatus(claim.id, "in_progress")}
                style={{
                  padding: "0.25rem 0.55rem",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  cursor: isPending ? "wait" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                En progreso
              </button>
            )}
            <button
              disabled={isPending}
              onClick={() => onUpdateStatus(claim.id, "resolved")}
              style={{
                padding: "0.25rem 0.55rem",
                borderRadius: "6px",
                border: "1px solid #86efac",
                background: "#dcfce7",
                color: "#166534",
                fontSize: "0.7rem",
                fontWeight: 600,
                cursor: isPending ? "wait" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Resolver ✓
            </button>
          </div>
        )}

        {claim.status === "resolved" && claim.resolvedAt && (
          <span style={{ fontSize: "0.68rem", color: "#059669" }}>
            Resuelto {new Date(claim.resolvedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
    </div>
  );
}
