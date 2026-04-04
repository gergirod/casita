"use client";

import { useRef, useState } from "react";

type PaymentInfo = {
  method: string | null;
  cbu:    string | null;
  name:   string | null;
} | null;

type Obligation = {
  id: string;
  title: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  dueDate: string;
  paymentLinkUrl?: string | null;
  billUrl?: string | null;
  proofUrl?: string | null;
  paidAt?: string | null;
  paymentInfo?: PaymentInfo;
};

type HistoryItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  dueDate: string;
  billUrl?: string | null;
  proofUrl?: string | null;
  paidAt?: string | null;
};

type Props = {
  token: string;
  initialObligations: Obligation[];
  history?: HistoryItem[];
};

const STATUS_LABEL: Record<string, string> = {
  pending:  "Pendiente",
  overdue:  "Vencida",
  upcoming: "Próxima",
  reminded: "Recordada",
};

const TYPE_LABEL: Record<string, string> = {
  rent: "Alquiler",
  expensas: "Expensas",
  electricity: "Luz",
  gas: "Gas",
  water: "Agua",
  internet: "Internet",
  custom: "Otro",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatAmount(amount: string, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function TenantPortal({ token, initialObligations, history = [] }: Props) {
  const [obligations, setObligations] = useState<Obligation[]>(initialObligations);
  const [uploading,   setUploading]   = useState<string | null>(null);
  const [uploaded,    setUploaded]    = useState<Set<string>>(new Set());
  const [error,       setError]       = useState<string | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const [activeObligation, setActiveObligation] = useState<string | null>(null);

  async function handleUpload(obligationId: string, file: File) {
    setUploading(obligationId);
    setError(null);
    const fd = new FormData();
    fd.append("obligationId", obligationId);
    fd.append("file", file);
    try {
      const res = await fetch(`/api/tenant/${token}/proof`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al subir el archivo");
      }
      setUploaded((prev) => new Set([...prev, obligationId]));
      setObligations((prev) => prev.filter((o) => o.id !== obligationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setUploading(null);
      setActiveObligation(null);
    }
  }

  function triggerFileInput(obligationId: string) {
    setActiveObligation(obligationId);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && activeObligation) handleUpload(activeObligation, file);
    e.target.value = "";
  }

  if (obligations.length === 0 && uploaded.size === 0 && history.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "1rem", padding: "2rem 1.5rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "0.4rem" }}>
          Todo al día
        </h2>
        <p style={{ fontSize: "0.88rem", color: "#374151" }}>
          No tenés obligaciones pendientes en este momento.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {obligations.length > 0 && (
        <div style={{ marginBottom: "0.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", margin: "0 0 0.2rem" }}>
            Pagos y comprobantes pendientes
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>
            Si tenés link de pago, usalo primero. Después subí la foto o PDF del comprobante.
          </p>
        </div>
      )}

      {obligations.map((ob) => {
        const isOverdue   = ob.status === "overdue";
        const isUploading = uploading === ob.id;

        return (
          <div
            key={ob.id}
            style={{
              background: "#fff",
              border: `1.5px solid ${isOverdue ? "#f5c0d0" : "#e5e7eb"}`,
              borderRadius: "1rem",
              padding: "1.1rem 1.15rem",
              display: "grid",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                <div>
                  <p style={{ fontWeight: 700, color: "#111827", fontSize: "0.95rem", margin: 0 }}>{ob.title}</p>
                  <p style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "0.15rem" }}>
                    {TYPE_LABEL[ob.type] ?? "Otro"} · vence {formatDate(ob.dueDate)}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontWeight: 800, color: isOverdue ? "#dc2626" : "#111827", fontSize: "1rem", margin: 0 }}>
                  {formatAmount(ob.amount, ob.currency)}
                </p>
                <span style={{
                  display: "inline-block", marginTop: "0.25rem", borderRadius: "999px",
                  padding: "0.15rem 0.5rem", fontSize: "0.65rem", fontWeight: 700,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                  background: isOverdue ? "#fef2f2" : "#ecfdf5",
                  color: isOverdue ? "#dc2626" : "#059669",
                  border: `1px solid ${isOverdue ? "#f5c0d0" : "#a7f3d0"}`,
                }}>
                  {STATUS_LABEL[ob.status] ?? ob.status}
                </span>
              </div>
            </div>

            {ob.paymentInfo?.method === "cbu" && ob.paymentInfo.cbu && (
              <div style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "0.75rem",
                padding: "0.75rem 0.9rem",
              }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Transferí a:
                </p>
                <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#111827", margin: "0 0 0.1rem", fontFamily: "monospace", letterSpacing: "0.02em" }}>
                  {ob.paymentInfo.cbu}
                </p>
                {ob.paymentInfo.name && (
                  <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: 0 }}>
                    Titular: {ob.paymentInfo.name}
                  </p>
                )}
              </div>
            )}

            {ob.paymentLinkUrl && (
              <a
                href={ob.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  justifyContent: "center",
                  width: "100%",
                  padding: "0.68rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  color: "#2d5a3e",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  textDecoration: "none",
                }}
              >
                {ob.paymentInfo?.method === "cbu" && ob.paymentInfo.cbu ? "O pagá con Mercado Pago" : "1) Pagar ahora"}
              </a>
            )}
            <button
              onClick={() => triggerFileInput(ob.id)}
              disabled={isUploading}
              style={{
                width: "100%", padding: "0.75rem", borderRadius: "0.75rem",
                border: "none",
                background: isUploading ? "#ecfdf5" : "#059669",
                color: isUploading ? "#374151" : "#fff",
                fontWeight: 600, fontSize: "0.9rem",
                cursor: isUploading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {isUploading ? "Subiendo..." : ob.paymentLinkUrl ? "2) Subir comprobante" : "Subir comprobante"}
            </button>
          </div>
        );
      })}

      {uploaded.size > 0 && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a8d9c0", borderRadius: "0.85rem", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#059669", fontWeight: 600, margin: 0 }}>
            {uploaded.size === 1
              ? "Comprobante enviado. El propietario lo va a revisar enseguida."
              : `${uploaded.size} comprobantes enviados. El propietario los va a revisar enseguida.`}
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #f5c0d0", borderRadius: "0.75rem", padding: "0.75rem 1rem" }}>
          <p style={{ fontSize: "0.84rem", color: "#dc2626", margin: 0 }}>{error}</p>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", margin: "0 0 0.6rem" }}>
            Historial de pagos
          </h2>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  background: "#fff",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "0.85rem",
                  padding: "0.85rem 1rem",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <p style={{ fontWeight: 700, color: "#111827", fontSize: "0.88rem", margin: 0 }}>{h.title}</p>
                    <p style={{ fontSize: "0.73rem", color: "#6b7280", marginTop: "0.15rem" }}>
                      {TYPE_LABEL[h.type] ?? "Otro"} · {formatDate(h.dueDate)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontWeight: 800, color: "#059669", fontSize: "0.95rem", margin: 0 }}>
                      {formatAmount(h.amount, h.currency)}
                    </p>
                    <span style={{
                      display: "inline-block", marginTop: "0.2rem", borderRadius: "999px",
                      padding: "0.12rem 0.45rem", fontSize: "0.62rem", fontWeight: 700,
                      letterSpacing: "0.04em", textTransform: "uppercase" as const,
                      background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0",
                    }}>
                      Pagado
                    </span>
                  </div>
                </div>

                {(h.billUrl || h.proofUrl) && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
                    {h.billUrl && (
                      <a
                        href={h.billUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.75rem", fontWeight: 600, color: "#374151",
                          background: "#f3f4f6", borderRadius: "0.5rem",
                          padding: "0.3rem 0.65rem", textDecoration: "none",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        📄 Ver factura
                      </a>
                    )}
                    {h.proofUrl && (
                      <a
                        href={h.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.75rem", fontWeight: 600, color: "#059669",
                          background: "#ecfdf5", borderRadius: "0.5rem",
                          padding: "0.3rem 0.65rem", textDecoration: "none",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        ✅ Ver comprobante
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
