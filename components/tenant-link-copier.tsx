"use client";

import { useState } from "react";

export function TenantLinkCopier({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/t/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      title="Copiar link de la casita del inquilino (para que suba su comprobante)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        fontSize: "0.72rem",
        fontWeight: 500,
        color: copied ? "#059669" : "#8e8e93",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "0.2rem 0",
        letterSpacing: "-0.01em",
        transition: "color 0.15s",
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Link copiado
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="3" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Casita del inquilino
        </>
      )}
    </button>
  );
}
