import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CasitaLockup } from "@/components/casita-logo";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="login-layout">
      {/* ── Left hero panel ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "clamp(1.75rem, 5vw, 3.5rem)",
          background: "#ffffff",
          backgroundImage:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(5,150,105,0.07) 0%, transparent 60%)",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "clamp(2.5rem, 7vw, 4rem)" }}>
          <CasitaLockup size={28} variant="hero" />
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 2.75rem)",
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.04em",
            color: "#1c1c1e",
            maxWidth: "20rem",
            margin: "0 0 0.9rem",
          }}
        >
          Gestioná tus alquileres sin perder tiempo ni energía.
        </h1>

        <p
          style={{
            color: "#6b7280",
            fontSize: "clamp(0.88rem, 2.2vw, 0.95rem)",
            lineHeight: 1.65,
            maxWidth: "24rem",
            margin: "0 0 2rem",
            letterSpacing: "-0.01em",
          }}
        >
          Una sola vista para saber qué está pago, qué sigue pendiente
          y a quién tenés que hacerle seguimiento hoy.
        </p>

        {/* Feature pills — minimal */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "2rem" }}>
          {[
            { icon: "●", text: "Pagos vencidos hoy", color: "#dc2626" },
            { icon: "●", text: "Comprobantes por verificar", color: "#d97706" },
            { icon: "●", text: "Facturas del mes", color: "#059669" },
          ].map(({ icon, text, color }) => (
            <span
              key={text}
              style={{
                fontSize: "0.74rem",
                fontWeight: 500,
                color: "#374151",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "0.28rem 0.6rem",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ fontSize: "0.5rem", color }}>{icon}</span>
              {text}
            </span>
          ))}
        </div>

        {/* Mobile form */}
        <div className="form-inline" style={{ marginBottom: "2.5rem" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "1.75rem 1.5rem",
              boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <AuthForm />
          </div>
        </div>

        {/* Pain points — iOS grouped list */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{
            margin: "0 0 0.75rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "#8e8e93",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            Lo que resuelve Casita
          </p>
          <div style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid rgba(0,0,0,0.07)",
            overflow: "hidden",
          }}>
            {PAIN_POINTS.map(({ before, after }, i) => (
              <PainCard key={before} before={before} after={after} isFirst={i === 0} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right / form aside — desktop only ── */}
      <div
        className="form-aside"
        style={{
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "3rem 2rem",
          background: "#f2f2f7",
          borderLeft: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={{
          background: "#fff",
          borderRadius: "20px",
          padding: "2.25rem 2rem",
          width: "100%",
          maxWidth: "360px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <AuthForm />
        </div>
      </div>
    </main>
  );
}

/* ── Pain point cards ─────────────────────────────────────── */
const PAIN_POINTS = [
  { before: "¿Me pagó este mes o todavía no?",            after: "Estado de cada unidad en tiempo real" },
  { before: "¿Me mandó el comprobante o me olvidé?",      after: "Comprobantes centralizados y verificables" },
  { before: "¿Dónde quedó la factura de servicios?",      after: "Boletas cargadas y ordenadas por unidad" },
  { before: "¿Qué tengo que reclamar hoy?",               after: "Prioridades claras para hacer seguimiento" },
];

function PainCard({ before, after, isFirst }: { before: string; after: string; isFirst: boolean }) {
  return (
    <div
      style={{
        padding: "0.8rem 1rem",
        borderTop: isFirst ? "none" : "1px solid rgba(0,0,0,0.06)",
        display: "grid",
        gap: "0.2rem",
      }}
    >
      <span style={{
        fontSize: "0.8rem",
        color: "#8e8e93",
        fontStyle: "italic",
        letterSpacing: "-0.01em",
      }}>
        &ldquo;{before}&rdquo;
      </span>
      <span style={{
        fontSize: "0.83rem",
        color: "#1c1c1e",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        letterSpacing: "-0.01em",
      }}>
        <div style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: "#059669",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {after}
      </span>
    </div>
  );
}

