"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuevoAlquilerPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantWhatsapp, setTenantWhatsapp] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!tenantName) { setErr("El nombre del inquilino es requerido."); return; }
    setBusy(true); setErr(null);

    const { workspaceId } = await params;
    const res = await fetch(`/api/workspaces/${workspaceId}/new-rental`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantName,
        tenantEmail: tenantEmail || undefined,
        tenantWhatsapp: tenantWhatsapp || undefined,
        leaseStartDate: leaseStart ? new Date(leaseStart).toISOString() : undefined,
        leaseEndDate: leaseEnd ? new Date(leaseEnd).toISOString() : undefined,
      }),
    });

    setBusy(false);
    if (res.ok) {
      startTransition(() => router.push(`/dashboard/${workspaceId}`));
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Error al crear el alquiler.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f2f2f7", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", padding: "0 1.25rem",
        height: "56px", background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,0,0,0.06)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href=".." style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#059669", fontWeight: 600, fontSize: "0.88rem", textDecoration: "none" }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M5.5 1L1 6l4.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Volver
        </Link>
        <p style={{ margin: "0 auto", fontWeight: 700, fontSize: "0.92rem", color: "#1c1c1e" }}>
          Nuevo alquiler
        </p>
        <div style={{ width: "60px" }} />
      </header>

      <div style={{ flex: 1, padding: "1.5rem 1.25rem", display: "grid", gap: "1rem", alignContent: "start", maxWidth: "480px", margin: "0 auto", width: "100%" }}>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              width: s === step ? "24px" : "8px", height: "8px", borderRadius: "4px",
              background: s <= step ? "#059669" : "#d1d5db",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* Step 1: Tenant info */}
        {step === 1 && (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.03em" }}>
                ¿Quién es el inquilino?
              </h1>
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#6b7280" }}>
                Datos de la persona que va a vivir en la casita.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
              <FieldRow label="Nombre completo" required>
                <input
                  autoFocus
                  className="field"
                  placeholder="Ej: María García"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "0.92rem", color: "#1c1c1e" }}
                />
              </FieldRow>
              <div style={{ height: "1px", background: "rgba(0,0,0,0.06)" }} />
              <FieldRow label="Email">
                <input
                  type="email"
                  className="field"
                  placeholder="maria@email.com"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "0.92rem", color: "#1c1c1e" }}
                />
              </FieldRow>
              <div style={{ height: "1px", background: "rgba(0,0,0,0.06)" }} />
              <FieldRow label="WhatsApp">
                <input
                  type="tel"
                  className="field"
                  placeholder="+54 9 11 1234-5678"
                  value={tenantWhatsapp}
                  onChange={(e) => setTenantWhatsapp(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "0.92rem", color: "#1c1c1e" }}
                />
              </FieldRow>
            </div>

            <button
              type="button"
              disabled={!tenantName}
              onClick={() => setStep(2)}
              style={{
                background: tenantName ? "#059669" : "#d1d5db",
                color: "#fff", border: "none", borderRadius: "14px",
                padding: "0.9rem", fontSize: "0.95rem", fontWeight: 700,
                cursor: tenantName ? "pointer" : "not-allowed",
                letterSpacing: "-0.01em",
              }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 2: Dates */}
        {step === 2 && (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.03em" }}>
                ¿Cuándo empieza y termina?
              </h1>
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#6b7280" }}>
                Las fechas del contrato. Podés completarlas después si no las tenés todavía.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
              <FieldRow label="Inicio del contrato">
                <input
                  type="date"
                  value={leaseStart}
                  onChange={(e) => setLeaseStart(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "0.88rem", color: "#1c1c1e" }}
                />
              </FieldRow>
              <div style={{ height: "1px", background: "rgba(0,0,0,0.06)" }} />
              <FieldRow label="Fin del contrato">
                <input
                  type="date"
                  value={leaseEnd}
                  onChange={(e) => setLeaseEnd(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "0.88rem", color: "#1c1c1e" }}
                />
              </FieldRow>
            </div>

            {err && (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#dc2626", background: "#fef2f2", padding: "0.6rem 0.85rem", borderRadius: "10px" }}>
                {err}
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: "#f2f2f7", color: "#1c1c1e", border: "none",
                  borderRadius: "14px", padding: "0.9rem", fontSize: "0.9rem",
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                style={{
                  background: "#059669", color: "#fff", border: "none",
                  borderRadius: "14px", padding: "0.9rem", fontSize: "0.95rem",
                  fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em",
                }}
              >
                {busy ? "Creando alquiler…" : "Iniciar alquiler"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              style={{
                background: "none", border: "none", color: "#8e8e93",
                fontSize: "0.8rem", cursor: "pointer", padding: "0.2rem",
              }}
            >
              Sin fechas por ahora — completar después
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function FieldRow({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0.75rem 1rem", gap: "0.75rem" }}>
      <span style={{ fontSize: "0.88rem", color: "#1c1c1e", fontWeight: 500, minWidth: "130px", flexShrink: 0 }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: "2px" }}>*</span>}
      </span>
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
