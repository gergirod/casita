import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TenantPortal } from "@/components/tenant-portal";
import { CasitaLockup } from "@/components/casita-logo";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const unit = await prisma.unit.findUnique({
    where: { tenantToken: token },
    include: {
      property:      { select: { name: true, address: true } },
      tenantContact: { select: { fullName: true } },
      obligations: {
        orderBy: { dueDate: "desc" },
      },
      obligationTemplates: {
        select: { id: true, paymentMethod: true, paymentCbu: true, paymentName: true },
      },
      contractHistory: {
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });

  // Map from templateId → payment info so obligations can display transfer details
  const paymentInfoMap = new Map(
    (unit?.obligationTemplates ?? []).map((t) => [
      t.id,
      { method: t.paymentMethod, cbu: t.paymentCbu, name: t.paymentName },
    ])
  );

  if (!unit) notFound();

  const allObligations = unit.obligations.map((o) => ({
    id:             o.id,
    title:          o.title,
    type:           o.type,
    status:         o.status,
    amount:         o.amount.toString(),
    currency:       o.currency,
    dueDate:        o.dueDate.toISOString(),
    paymentLinkUrl: o.paymentLinkUrl ?? null,
    billUrl:        o.originalBillUrl ?? null,
    proofUrl:       o.proofUrl       ?? null,
    paidAt:         o.paidAt?.toISOString() ?? null,
    paymentInfo:    o.templateId ? (paymentInfoMap.get(o.templateId) ?? null) : null,
  }));

  const obligations = allObligations.filter((o) =>
    ["pending", "overdue", "upcoming", "reminded"].includes(o.status)
  );
  const history = allObligations.filter((o) =>
    ["verified", "paid", "proof_uploaded", "proof_uploaded_owner"].includes(o.status)
  );

  const overdueCount = obligations.filter((o) => o.status === "overdue").length;
  const pendingCount = obligations.filter((o) => o.status === "pending").length;
  const contractUrl  = unit.contractHistory[0]?.url ?? unit.contractUrl ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafb",
        padding: "0 0 3rem",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#deeee7",
          padding: "1.25rem 1.25rem 1.5rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <CasitaLockup size={26} variant="hero" />
        <div style={{ marginTop: "1.25rem" }}>
          {unit.tenantContact?.fullName && (
            <p style={{ fontSize: "0.8rem", color: "#374151", marginBottom: "0.2rem" }}>
              Hola, {unit.tenantContact.fullName}
            </p>
          )}
          <h1
            style={{
              fontSize: "1.2rem",
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {unit.property.name}{unit.identifier !== "principal" ? ` · ${unit.identifier}` : ""}
          </h1>
          {unit.property.address && (
            <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.2rem" }}>
              {unit.property.address}
            </p>
          )}
          <p style={{ fontSize: "0.78rem", color: overdueCount > 0 ? "#dc2626" : "#374151", marginTop: "0.45rem", marginBottom: 0 }}>
            {overdueCount > 0
              ? `Tenés ${overdueCount} pago${overdueCount === 1 ? "" : "s"} vencido${overdueCount === 1 ? "" : "s"}: subí el comprobante para evitar seguimiento.`
              : pendingCount > 0
                ? `Tenés ${pendingCount} pago${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"}: subí el comprobante apenas pagues.`
                : "No hay acciones pendientes por ahora."}
          </p>
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
        {contractUrl && (
          <a
            href={contractUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              background: "#fff",
              border: "1.5px solid #e5e7eb",
              borderRadius: "1rem",
              padding: "0.9rem 1.1rem",
              textDecoration: "none",
              color: "#111827",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>📄</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem" }}>Ver contrato de alquiler</p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280", marginTop: "0.1rem" }}>Abre el PDF en una nueva pestaña</p>
            </div>
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#9ca3af" }}>↗</span>
          </a>
        )}
        <TenantPortal token={token} initialObligations={obligations} history={history} />
      </main>
    </div>
  );
}
