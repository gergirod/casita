"use client";

import { getProvidersByType, type ServiceType } from "@/lib/providers";

type Props = {
  type: ServiceType;
  value: string | null;
  onChange: (slug: string | null) => void;
};

export function ProviderPicker({ type, value, onChange }: Props) {
  const providers = getProvidersByType(type);
  if (providers.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <p style={{ margin: 0, fontSize: "0.73rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Proveedor
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {providers.map((p) => {
          const selected = value === p.slug;
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => onChange(selected ? null : p.slug)}
              title={p.region}
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0.35rem 0.65rem",
                borderRadius: "0.6rem",
                border: selected ? "1.5px solid var(--c-accent)" : "1.5px solid var(--c-border)",
                background: selected ? "var(--c-accent-light)" : "var(--c-surface)",
                color: selected ? "var(--c-accent)" : "var(--c-text-body)",
                fontWeight: selected ? 700 : 400,
                fontSize: "0.79rem",
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <span>{p.name}</span>
              {p.region && p.region !== "—" && (
                <span style={{ fontSize: "0.65rem", color: selected ? "var(--c-accent)" : "var(--c-text-muted)", fontWeight: 400 }}>
                  {p.region}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Show matched email patterns */}
      {value && (() => {
        const prov = providers.find((p) => p.slug === value);
        if (!prov || prov.senderPatterns.length === 0) return null;
        return (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            padding: "0.45rem 0.6rem",
            background: "#f0fdf4",
            border: "1px solid var(--c-border)",
            borderRadius: "0.55rem",
            marginTop: "0.1rem",
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginTop: "1px", flexShrink: 0 }}>
              <rect x="1" y="2.5" width="11" height="8.5" rx="1.5" stroke="var(--c-accent)" strokeWidth="1.3"/>
              <path d="M1 4l5.5 4L12 4" stroke="var(--c-accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, color: "#059669" }}>
                Filtro de email para n8n:
              </p>
              <p style={{ margin: "0.1rem 0 0", fontSize: "0.68rem", color: "#374151", lineHeight: 1.5 }}>
                {prov.senderPatterns.join("  ·  ")}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
