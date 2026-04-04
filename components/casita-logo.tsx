/**
 * CasitaLogo — marca abstracta.
 *
 * El símbolo es un ARCO: la entrada a una casita, trazada como
 * un único stroke limpio. Sin casa literal. Concepto: bienvenida,
 * hogar, pertenencia — como el bélo de Airbnb pero con arco español.
 */

type LogoVariant = "hero" | "nav" | "form";

const strokeColor: Record<LogoVariant, string> = {
  hero: "#059669",
  nav:  "#059669",
  form: "#059669",
};

type LogoProps = {
  size?: number;
  variant?: LogoVariant;
};

export function CasitaLogo({ size = 32, variant = "nav" }: LogoProps) {
  const stroke = strokeColor[variant];
  const sw = size * 0.14; // stroke proporcional al tamaño

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Casita"
    >
      {/*
        El arco: dos "piernas" verticales que se unen en una
        curva suave en la cima — como la entrada de una casa,
        sin ser literalmente una casa.
      */}
      <path
        d="M4 34 L4 17 Q4 3 16 3 Q28 3 28 17 L28 34"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function CasitaWordmark({ variant = "nav" }: { variant?: LogoVariant }) {
  return (
    <span
      style={{
        fontSize: "1.1rem",
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: "#111827",
        lineHeight: 1,
      }}
    >
      casita
    </span>
  );
}

/* Lockup: símbolo + wordmark juntos */
export function CasitaLockup({
  size = 28,
  variant = "nav",
}: {
  size?: number;
  variant?: LogoVariant;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
      <CasitaLogo size={size} variant={variant} />
      <CasitaWordmark variant={variant} />
    </div>
  );
}
