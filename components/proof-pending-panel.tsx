"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProofItem {
  id: string;
  title: string;
  amount: string;        // pre-formatted
  currency: string;
  dueDate: string;       // ISO
  proofUrl: string | null;
  tenantName: string | null;
  propertyName: string;
}

interface Props {
  items: ProofItem[];
}

export function ProofPendingPanel({ items }: Props) {
  const router = useRouter();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => !doneIds.has(i.id));
  if (visible.length === 0) return null;

  async function onVerify(id: string) {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/obligations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "verified" }),
      });
      if (res.ok) {
        setDoneIds((prev) => new Set([...prev, id]));
        router.refresh();
      }
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.85rem 1.1rem 0.6rem",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "#fef3c7",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#92400e",
          }}
        >
          {visible.length}
        </span>
        <span
          style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}
        >
          Comprobantes a verificar
        </span>
      </div>

      {/* Items */}
      <div style={{ display: "grid", gap: 0 }}>
        {visible.map((item, idx) => {
          const due = new Date(item.dueDate).toLocaleDateString("es-AR", {
            day: "numeric",
            month: "short",
          });
          const isLast = idx === visible.length - 1;
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1.1rem",
                borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.04)",
              }}
            >
              {/* Left: info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#1c1c1e",
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "0.73rem",
                    color: "#6b7280",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.tenantName ? `${item.tenantName} · ` : ""}{item.currency} {item.amount} · {due}
                </p>
              </div>

              {/* Proof link */}
              {item.proofUrl && (
                <a
                  href={item.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ver comprobante"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: "#f3f4f6",
                    color: "#374151",
                    textDecoration: "none",
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2h5v1.5H3.5v7h7V9H12v3H2V2z" fill="currentColor" />
                    <path d="M8 2h4v4h-1.5V4.06L6.53 8 5.5 6.97 9.44 3H8V2z" fill="currentColor" />
                  </svg>
                </a>
              )}

              {/* Verify button */}
              <button
                onClick={() => onVerify(item.id)}
                disabled={verifyingId === item.id}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.32rem 0.7rem",
                  borderRadius: "8px",
                  border: "1.5px solid #059669",
                  background: verifyingId === item.id ? "#f0fdf4" : "#059669",
                  color: verifyingId === item.id ? "#059669" : "#fff",
                  cursor: verifyingId === item.id ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                {verifyingId === item.id ? "…" : "✓ Verificar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
