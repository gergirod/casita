"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CasitaLockup } from "@/components/casita-logo";

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  /* ── Form state ─────────────────────────────────────────────────── */
  const [workspaceName,  setWorkspaceName]  = useState("");
  const [tenantName,     setTenantName]     = useState("");
  const [tenantEmail,    setTenantEmail]    = useState("");
  const [tenantWhatsapp, setTenantWhatsapp] = useState("");
  const [rentAmount,     setRentAmount]     = useState("");
  const [rentDueDay,     setRentDueDay]     = useState("10");
  const [currency,       setCurrency]       = useState<"ARS" | "USD">("ARS");
  const [paymentMethod,  setPaymentMethod]  = useState<"cbu" | "mp_link" | null>(null);
  const [paymentCbu,     setPaymentCbu]     = useState("");
  const [paymentName,    setPaymentName]    = useState("");
  const [paymentMpLink,  setPaymentMpLink]  = useState("");

  /* ── Submit state ───────────────────────────────────────────────── */
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdIds,  setCreatedIds]  = useState<{ workspaceId: string; unitId: string } | null>(null);

  /* ── Welcome message (step 4) ──────────────────────────────────── */
  const [welcomeSending, setWelcomeSending] = useState(false);
  const [welcomeDone,    setWelcomeDone]    = useState(false);
  const [welcomeError,   setWelcomeError]   = useState<string | null>(null);

  /* ── Contract upload (step 4) ───────────────────────────────────── */
  const contractInputRef    = useRef<HTMLInputElement>(null);
  const [contractUploading, setContractUploading] = useState(false);
  const [contractDone,      setContractDone]      = useState(false);
  const [contractError,     setContractError]     = useState<string | null>(null);

  function goNext() { setStep((s) => Math.min(TOTAL_STEPS, s + 1)); }
  function goBack() { setStep((s) => Math.max(1, s - 1)); }

  /* ── API call — fires on step 3 submit ─────────────────────────── */
  async function submitAll() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName,
          propertyName:    workspaceName,
          unitIdentifier:  "principal",
          tenant: tenantName ? { fullName: tenantName, email: tenantEmail || undefined, whatsapp: tenantWhatsapp || undefined } : undefined,
          obligation: rentAmount
            ? {
                type: "rent",
                currency,
                amount: Number(rentAmount),
                dueDay: Number(rentDueDay),
                paymentMethod: paymentMethod || null,
                paymentCbu:    paymentMethod ? (paymentCbu || null)  : null,
                paymentName:   paymentMethod ? (paymentName || null) : null,
                paymentMpLink: null,
              }
            : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") ?? data?.error ?? "No se pudo guardar");

      setCreatedIds({ workspaceId: data.workspaceId, unitId: data.unitId });
      setStep(4);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Welcome message ───────────────────────────────────────────── */
  async function sendWelcome() {
    if (!createdIds) return;
    setWelcomeSending(true);
    setWelcomeError(null);
    const res = await fetch(`/api/units/${createdIds.unitId}/send-welcome`, { method: "POST" });
    setWelcomeSending(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setWelcomeError(d?.error ?? "No se pudo enviar el mensaje");
    } else {
      setWelcomeDone(true);
    }
  }

  /* ── Contract upload ────────────────────────────────────────────── */
  async function onContractFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !createdIds) return;
    setContractUploading(true);
    setContractError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/units/${createdIds.unitId}/contract`, { method: "POST", body: fd });
    setContractUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setContractError(d?.error ?? "No se pudo subir el archivo");
    } else {
      setContractDone(true);
    }
  }

  function onFinish() {
    if (!createdIds) return;
    router.push(`/dashboard/${createdIds.workspaceId}`);
    router.refresh();
  }

  const progress = (step / TOTAL_STEPS) * 100;

  const stepTitles = [
    "¿Cómo se llama la casita?",
    "¿Quién es el inquilino?",
    "¿Cuánto es el alquiler?",
    "¡Casita creada!",
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>

      {(submitting || contractUploading) && (
        <InlineLoadingOverlay
          message={submitting ? "Creando tu casita…" : "Subiendo el contrato…"}
        />
      )}

      {/* Top bar */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 1.25rem", borderBottom: "1px solid var(--c-border)",
        background: "var(--c-surface)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <CasitaLockup size={24} variant="nav" />
        <span style={{ fontSize: "0.78rem", color: "var(--c-text-muted)", fontWeight: 500 }}>
          {step} / {TOTAL_STEPS}
        </span>
      </header>

      {/* Progress bar */}
      <div style={{ height: "3px", background: "var(--c-border)" }}>
        <div style={{
          height: "100%", background: "var(--c-accent)",
          width: `${progress}%`,
          transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        width: "100%", maxWidth: "min(560px, 100%)", margin: "0 auto",
        padding: "2.5rem 1.25rem 7rem", boxSizing: "border-box",
        gap: "1.25rem",
      }}>

        {/* Step label */}
        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, color: "var(--c-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Paso {step} de {TOTAL_STEPS}
        </p>

        <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 6vw, 2rem)", fontWeight: 800, color: "var(--c-text)", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          {stepTitles[step - 1]}
        </h1>

        {submitError && (
          <div style={{ padding: "0.7rem 0.9rem", background: "var(--c-danger-bg)", color: "var(--c-danger)", borderRadius: "0.65rem", fontSize: "0.84rem" }}>
            {submitError}
          </div>
        )}

        {/* ── Step 1: Nombre ── */}
        {step === 1 && (
          <form id="step-form-1" onSubmit={(e) => { e.preventDefault(); goNext(); }} style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--c-text-body)", lineHeight: 1.6 }}>
              Usá el nombre con el que la vas a ubicar rápido: la dirección, el barrio, lo que quieras.
            </p>
            <input
              autoFocus
              className="field"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ej: Palermo Soho, Thames 2450 2B"
              required
              style={{ fontSize: "1.05rem" }}
            />
            <button type="submit" className="btn-primary" style={{ marginTop: "0.25rem" }}>
              Continuar →
            </button>
          </form>
        )}

        {/* ── Step 2: Inquilino ── */}
        {step === 2 && (
          <form id="step-form-2" onSubmit={(e) => { e.preventDefault(); goNext(); }} style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--c-text-body)", lineHeight: 1.6 }}>
              Con su email o teléfono le llegan los recordatorios automáticos.
            </p>
            <input
              autoFocus
              className="field"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Nombre completo"
              required
            />
            <input
              className="field"
              type="email"
              value={tenantEmail}
              onChange={(e) => setTenantEmail(e.target.value)}
              placeholder="Email (opcional)"
            />
            <input
              className="field"
              value={tenantWhatsapp}
              onChange={(e) => setTenantWhatsapp(e.target.value)}
              placeholder="WhatsApp ej: +54 9 11 1234-5678 (opcional)"
            />
            <button type="submit" className="btn-primary" style={{ marginTop: "0.25rem" }}>
              Continuar →
            </button>
          </form>
        )}

        {/* ── Step 3: Alquiler ── */}
        {step === 3 && (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--c-text-body)", lineHeight: 1.6 }}>
              Solo el alquiler por ahora. Expensas y servicios los agregás adentro de la casita cuando lleguen las boletas.
            </p>

            {/* Currency toggle */}
            <div style={{
              display: "flex", background: "rgba(118,118,128,0.12)",
              borderRadius: "9px", padding: "2px", gap: "2px",
            }}>
              {(["ARS", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  style={{
                    flex: 1, height: "36px", border: "none", borderRadius: "7px",
                    fontSize: "0.88rem", fontWeight: currency === c ? 600 : 400,
                    background: currency === c ? "#ffffff" : "transparent",
                    color: currency === c ? "#1c1c1e" : "#636366",
                    cursor: "pointer",
                    boxShadow: currency === c ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    transition: "background 0.15s, box-shadow 0.15s",
                  }}
                >
                  {c === "ARS" ? "$ Pesos" : "U$D Dólares"}
                </button>
              ))}
            </div>

            <div style={{ background: "var(--c-surface)", borderRadius: "14px", border: "1px solid var(--c-border)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "0 1rem", minHeight: "56px", borderBottom: "1px solid var(--c-border)" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--c-text-body)", fontWeight: 500, flex: 1 }}>Monto mensual</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.88rem", color: "var(--c-text-muted)" }}>{currency === "ARS" ? "$" : "U$D"}</span>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="1"
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    placeholder={currency === "ARS" ? "380000" : "500"}
                    required
                    style={{
                      border: "none", outline: "none", background: "transparent",
                      fontSize: "1.05rem", fontWeight: 600, textAlign: "right",
                      color: "var(--c-text)", width: "140px",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "0 1rem", minHeight: "56px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--c-text-body)", fontWeight: 500, flex: 1 }}>Día de vencimiento</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={rentDueDay}
                    onChange={(e) => setRentDueDay(e.target.value)}
                    style={{
                      border: "none", outline: "none", background: "transparent",
                      fontSize: "1.05rem", fontWeight: 600, textAlign: "right",
                      color: "var(--c-text)", width: "48px",
                    }}
                  />
                  <span style={{ fontSize: "0.85rem", color: "var(--c-text-muted)" }}>de cada mes</span>
                </div>
              </div>
            </div>

            {/* ── Método de cobro ── */}
            <div>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--c-text-body)" }}>
                ¿Cómo te pagan? <span style={{ fontWeight: 400, color: "var(--c-text-muted)" }}>(opcional)</span>
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {([
                  { id: "cbu",     label: "CBU / Alias" },
                  { id: "mp_link", label: "Mercado Pago" },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(paymentMethod === id ? null : id)}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: "999px",
                      border: `1.5px solid ${paymentMethod === id ? "var(--c-accent)" : "var(--c-border)"}`,
                      background: paymentMethod === id ? "var(--c-accent-light)" : "var(--c-surface)",
                      color: paymentMethod === id ? "var(--c-accent)" : "var(--c-text-muted)",
                      fontSize: "0.84rem",
                      fontWeight: paymentMethod === id ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(paymentMethod === "cbu" || paymentMethod === "mp_link") && (
                <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
                  <input
                    className="field"
                    placeholder={paymentMethod === "mp_link" ? "Alias de Mercado Pago (ej: nombre.mp)" : "CBU o alias (ej: mialiasbank)"}
                    value={paymentCbu}
                    onChange={(e) => setPaymentCbu(e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Nombre y apellido del titular"
                    value={paymentName}
                    onChange={(e) => setPaymentName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn-primary"
              disabled={submitting || !rentAmount}
              onClick={submitAll}
            >
              {submitting ? "Creando casita…" : "Crear casita →"}
            </button>
          </div>
        )}

        {/* ── Step 4: Bienvenida + Contrato ── */}
        {step === 4 && (
          <div style={{ display: "grid", gap: "1.25rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--c-text-body)", lineHeight: 1.6 }}>
              La casita está lista. Podés mandarle un mensaje de bienvenida al inquilino y subir el contrato antes de arrancar.
            </p>

            {/* ── Welcome message ── */}
            {(() => {
              const hasContact = tenantEmail || tenantWhatsapp;
              const channels = [
                ...(tenantEmail    ? ["email"]    : []),
                ...(tenantWhatsapp ? ["WhatsApp"] : []),
              ];
              const channelLabel = channels.join(" y ");

              if (!hasContact) return (
                <div style={{ padding: "0.85rem 1rem", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "12px" }}>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--c-text-muted)", lineHeight: 1.5 }}>
                    Sin email ni WhatsApp no podemos mandar la bienvenida. Podés agregarlo después desde Configuración.
                  </p>
                </div>
              );

              if (welcomeDone) return (
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.9rem 1rem", background: "var(--c-success-bg)", border: "1px solid #a8d9c0", borderRadius: "0.85rem", fontSize: "0.85rem", color: "var(--c-success)", fontWeight: 600 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8.5l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Bienvenida enviada por {channelLabel}
                </div>
              );

              return (
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "14px", padding: "1rem 1.1rem" }}>
                  <p style={{ margin: "0 0 0.2rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--c-text)" }}>
                    Mensaje de bienvenida
                  </p>
                  <p style={{ margin: "0 0 0.85rem", fontSize: "0.8rem", color: "var(--c-text-muted)", lineHeight: 1.5 }}>
                    Le mandamos a <strong>{tenantName || tenantEmail || tenantWhatsapp}</strong> el link de su casita
                    {paymentMethod === "cbu" && paymentCbu ? " y los datos del CBU" : ""}
                    {paymentMethod === "mp_link" && paymentMpLink ? " y el link de Mercado Pago" : ""}
                    {" "}por {channelLabel}.
                  </p>
                  {welcomeError && (
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", color: "var(--c-danger)" }}>{welcomeError}</p>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={sendWelcome}
                    disabled={welcomeSending}
                    style={{ width: "100%", fontSize: "0.9rem" }}
                  >
                    {welcomeSending ? "Enviando…" : `Enviar bienvenida por ${channelLabel}`}
                  </button>
                </div>
              );
            })()}

            {/* ── Contract upload ── */}
            {contractDone ? (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                padding: "0.9rem 1rem", background: "var(--c-success-bg)",
                border: "1px solid #a8d9c0", borderRadius: "0.85rem",
                fontSize: "0.85rem", color: "var(--c-success)", fontWeight: 600,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8.5l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Contrato subido
              </div>
            ) : (
              <label htmlFor="contract-upload" style={{
                display: "flex", alignItems: "center", gap: "0.85rem",
                padding: "0.9rem 1rem", border: "1.5px dashed var(--c-border)",
                borderRadius: "12px", background: "var(--c-surface)",
                cursor: contractUploading ? "not-allowed" : "pointer",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1" stroke="var(--c-text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>
                  <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "var(--c-text)" }}>Subir contrato</p>
                  <p style={{ margin: "0.1rem 0 0", fontSize: "0.74rem", color: "var(--c-text-muted)" }}>Opcional · PDF, JPG o PNG</p>
                </div>
                <input
                  id="contract-upload"
                  ref={contractInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: "none" }}
                  onChange={onContractFileChange}
                  disabled={contractUploading}
                />
              </label>
            )}

            {contractError && (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--c-danger)" }}>{contractError}</p>
            )}

            <button
              type="button"
              className="btn-primary"
              onClick={onFinish}
              style={{ fontSize: "1rem" }}
            >
              Ir a mi casita →
            </button>
          </div>
        )}

      </div>

      {/* Back button — sticky bottom */}
      {step > 1 && step < 4 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom))",
          background: "var(--c-surface)", borderTop: "1px solid var(--c-border)",
          zIndex: 20,
        }}>
          <button type="button" className="btn-secondary" onClick={goBack}>
            ← Atrás
          </button>
        </div>
      )}

    </div>
  );
}

/* ── Inline loading overlay (replaces deleted loading-overlay component) ── */
function InlineLoadingOverlay({ message }: { message: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(242,242,247,0.88)",
      backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "0.75rem",
    }}>
      <div style={{
        width: "44px", height: "44px", borderRadius: "12px",
        background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </div>
      <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "#1c1c1e" }}>
        {message}
      </p>
    </div>
  );
}
