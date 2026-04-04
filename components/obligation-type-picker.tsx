"use client";

import { useState } from "react";

export type ObligationTypeValue =
  | "rent"
  | "expensas"
  | "electricity"
  | "gas"
  | "water"
  | "internet";

export const TYPE_META: Record<ObligationTypeValue, { label: string }> = {
  rent:        { label: "Alquiler" },
  expensas:    { label: "Expensas" },
  electricity: { label: "Luz" },
  gas:         { label: "Gas" },
  water:       { label: "Agua" },
  internet:    { label: "Internet" },
};

const SERVICE_TYPES: ObligationTypeValue[] = ["electricity", "gas", "water", "internet"];

const SERVICE_EMOJI: Record<string, string> = {
  electricity: "⚡",
  gas:         "🔥",
  water:       "💧",
  internet:    "📡",
};

type Props = {
  value: string;
  onChange: (v: ObligationTypeValue) => void;
};

export function ObligationTypePicker({ value, onChange }: Props) {
  const isService = SERVICE_TYPES.includes(value as ObligationTypeValue);
  const [serviceExpanded, setServiceExpanded] = useState(isService);

  function handleTop(v: ObligationTypeValue | "service-group") {
    if (v === "service-group") {
      setServiceExpanded(true);
      if (!isService) onChange("electricity");
    } else {
      setServiceExpanded(false);
      onChange(v);
    }
  }

  const topOptions = [
    { value: "rent",          label: "Alquiler", sub: "Pago mensual del inquilino" },
    { value: "expensas",      label: "Expensas", sub: "Gastos comunes del edificio" },
    { value: "service-group", label: "Servicio", sub: "Luz, gas, agua, internet…" },
  ];

  return (
    <div style={{ display: "grid", gap: "0.55rem" }}>
      {/* ── Main grouped list ── */}
      <div style={{
        background: "#ffffff",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.07)",
      }}>
        {topOptions.map((opt, i) => {
          const selected = opt.value === "service-group" ? isService : value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTop(opt.value as ObligationTypeValue | "service-group")}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "0 14px",
                minHeight: "52px",
                background: selected ? "rgba(61,107,84,0.08)" : "transparent",
                border: "none",
                borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                gap: "12px",
                textAlign: "left",
                transition: "background 0.1s",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#1c1c1e", letterSpacing: "-0.01em" }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: "0.73rem", color: "#8e8e93", marginTop: "1px" }}>
                  {opt.sub}
                </div>
              </div>
              <RadioCircle selected={selected} />
            </button>
          );
        })}
      </div>

      {/* ── Service sub-grid ── */}
      {serviceExpanded && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.4rem",
          paddingLeft: "0.5rem",
        }}>
          {SERVICE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "10px",
                border: value === t
                  ? "2px solid var(--c-accent)"
                  : "1px solid rgba(0,0,0,0.07)",
                background: value === t ? "rgba(61,107,84,0.06)" : "#ffffff",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{SERVICE_EMOJI[t]}</span>
              <span style={{
                fontSize: "0.84rem",
                fontWeight: value === t ? 600 : 500,
                color: value === t ? "var(--c-accent)" : "#1c1c1e",
                letterSpacing: "-0.01em",
              }}>
                {TYPE_META[t].label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RadioCircle({ selected }: { selected: boolean }) {
  return (
    <div style={{
      width: "26px",
      height: "26px",
      borderRadius: "50%",
      border: selected ? "none" : "2px solid #c7c7cc",
      background: selected ? "#059669" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      transition: "all 0.15s",
      boxShadow: selected ? "0 1px 4px rgba(61,107,84,0.4)" : "none",
    }}>
      {selected && (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2.5 6.5l3 3 5-5.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
