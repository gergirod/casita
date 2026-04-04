/**
 * ActivityFeed — server component.
 *
 * Renders a compact, read-only list of recent workspace activity events
 * sourced from ActivityLog. No client-side interactivity, no use client.
 *
 * All display decisions (labels, tones, actor names) live in the pure
 * mapping function `toFeedEntry` below — no side effects, easy to test.
 */

import type { ActivityItem } from "@/lib/dashboard-data";

// ─── Internal feed entry shape ────────────────────────────────────

interface FeedEntry {
  id:    string;
  label: string;   // primary text: "Comprobante recibido — Alquiler abril"
  sub:   string;   // secondary: "Inquilino · WhatsApp"  or  "Automático"
  time:  string;   // absolute: "10 abr · 15:32"
  dot:   string;   // hex color of the status dot
}

// ─── Tone → dot color ─────────────────────────────────────────────

const TONE_COLOR: Record<"green" | "yellow" | "red" | "neutral", string> = {
  green:   "#059669",
  yellow:  "#d97706",
  red:     "#dc2626",
  neutral: "#9ca3af",
};

// ─── Channel display ──────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp:  "WhatsApp",
  dashboard: "Dashboard",
  cron:      "sistema",
  api:       "API",
  webhook:   "Webhook",
};

// ─── Actor display ────────────────────────────────────────────────

function actorLabel(actorType: string): string {
  switch (actorType) {
    case "owner":  return "Vos";
    case "tenant": return "Inquilino";
    case "system": return "Sistema";
    case "cron":   return "Automático";
    default:       return "Sistema";
  }
}

// ─── Sub-line builder ─────────────────────────────────────────────
//
// Rules (per spec):
//   - cron + channel=cron → show only "Automático" (avoid "Automático · sistema" redundancy)
//   - otherwise           → "{actor} · {channel}" if channel is useful, else just "{actor}"

function buildSub(actorType: string, channel: string | null): string {
  const actor = actorLabel(actorType);
  if (actorType === "cron" && (!channel || channel === "cron")) return actor;
  const ch = channel ? CHANNEL_LABEL[channel] : null;
  return ch ? `${actor} · ${ch}` : actor;
}

// ─── Absolute timestamp ───────────────────────────────────────────
//
// Using absolute dates avoids SSR/hydration mismatches that relative
// timestamps ("hace 2h") cause when re-calculated on the client.

function formatTime(iso: string): string {
  const d = new Date(iso);
  const day   = d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  const clock = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${clock}`;
}

// ─── Core mapping: ActivityItem → FeedEntry ───────────────────────
//
// Every metadata access uses optional chaining + fallback so old or
// incomplete events never crash the feed.

function toFeedEntry(item: ActivityItem): FeedEntry {
  const m    = item.metadata;
  const title = (m?.title as string | undefined) ?? "Sin título";

  let label = "Evento del sistema";
  let tone: "green" | "yellow" | "red" | "neutral" = "neutral";

  switch (item.action) {

    case "obligation.created": {
      const recurring = Boolean(m?.recurring);
      label = recurring
        ? `Cobro recurrente configurado — ${title}`
        : `Cobro manual creado — ${title}`;
      tone = "neutral";
      break;
    }

    case "obligation.updated": {
      const next = (m?.newStatus as string | undefined) ?? "";
      const prev = (m?.previousStatus as string | undefined) ?? "";
      if (next === "overdue") {
        label = `Cobro vencido — ${title}`;
        tone  = "red";
      } else if (next === "verified") {
        label = `Pago verificado — ${title}`;
        tone  = "green";
      } else if (next === "cancelled") {
        label = `Cobro cancelado — ${title}`;
        tone  = "neutral";
      } else if (next === "pending" && prev === "cancelled") {
        label = `Cobro reabierto — ${title}`;
        tone  = "neutral";
      } else if (next === "reminded") {
        label = `Marcado como recordado — ${title}`;
        tone  = "neutral";
      } else {
        label = `Cobro actualizado — ${title}`;
        tone  = "neutral";
      }
      break;
    }

    case "proof.uploaded": {
      label = item.actorType === "tenant"
        ? `Comprobante recibido — ${title}`
        : `Comprobante registrado — ${title}`;
      tone = "yellow";
      break;
    }

    case "payment.verified": {
      const source = m?.source as string | undefined;
      label = source === "mercadopago"
        ? `Pago MercadoPago verificado — ${title}`
        : `Pago verificado — ${title}`;
      tone = "green";
      break;
    }

    case "reminder.sent": {
      // metadata.channels can be string[] or undefined
      label = `Recordatorio enviado — ${title}`;
      tone  = "neutral";
      break;
    }

    case "claim.created": {
      const desc = (m?.description as string | undefined) ?? "";
      label = desc
        ? `Nuevo reclamo: ${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}`
        : "Nuevo reclamo abierto";
      tone = "red";
      break;
    }

    case "claim.updated": {
      const next = (m?.newStatus as string | undefined) ?? "";
      if (next === "resolved") {
        label = "Reclamo resuelto";
        tone  = "green";
      } else if (next === "in_progress") {
        label = "Reclamo tomado — en progreso";
        tone  = "yellow";
      } else {
        label = "Reclamo actualizado";
        tone  = "neutral";
      }
      break;
    }

    default:
      label = "Evento del sistema";
      tone  = "neutral";
  }

  return {
    id:    item.id,
    label,
    sub:   buildSub(item.actorType, item.channel),
    time:  formatTime(item.createdAt),
    dot:   TONE_COLOR[tone],
  };
}

// ─── Component ────────────────────────────────────────────────────

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const entries = items.map(toFeedEntry);

  return (
    <div style={{
      background:   "#ffffff",
      borderRadius: "16px",
      border:       "1px solid rgba(0,0,0,0.07)",
      boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
      overflow:     "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding:        "1rem 1.25rem 0.75rem",
        borderBottom:   "1px solid rgba(0,0,0,0.05)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            "0.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Clock icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#111827" }}>
            Actividad reciente
          </h3>
        </div>
        {entries.length > 0 && (
          <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 500 }}>
            Últimos {entries.length} evento{entries.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div style={{ padding: "0.35rem 0 0.5rem" }}>
          {entries.map((entry, i) => (
            <FeedRow
              key={entry.id}
              entry={entry}
              isLast={i === entries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Feed row ─────────────────────────────────────────────────────

function FeedRow({ entry, isLast }: { entry: FeedEntry; isLast: boolean }) {
  return (
    <div style={{
      display:      "flex",
      alignItems:   "flex-start",
      gap:          "0.75rem",
      padding:      "0.65rem 1.25rem",
      borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.04)",
    }}>
      {/* Color dot */}
      <div style={{
        width:        "8px",
        height:       "8px",
        borderRadius: "50%",
        background:   entry.dot,
        flexShrink:   0,
        marginTop:    "4px",
      }} />

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin:       0,
          fontSize:     "0.83rem",
          fontWeight:   500,
          color:        "#1c1c1e",
          letterSpacing: "-0.01em",
          lineHeight:   1.4,
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}>
          {entry.label}
        </p>
        <p style={{
          margin:    "1px 0 0",
          fontSize:  "0.7rem",
          color:     "#9ca3af",
          fontWeight: 400,
        }}>
          {entry.sub} · {entry.time}
        </p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <div style={{
      padding:   "2rem 1.25rem",
      textAlign: "center",
    }}>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", fontWeight: 500 }}>
        Sin actividad registrada aún.
      </p>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#c7c7cc" }}>
        Los próximos eventos del sistema aparecerán acá.
      </p>
    </div>
  );
}
