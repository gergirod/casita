"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WhatsAppSettings } from "@/components/whatsapp-settings";
import { WhatsAppOwnerOnboarding } from "@/components/whatsapp-owner-onboarding";

type TenantContact = {
  id: string;
  fullName: string;
  email: string | null;
  whatsapp: string | null;
};

type ContractHistoryItem = {
  id: string;
  url: string;
  uploadedAt: string;
};

type Unit = {
  id: string;
  contractUrl: string | null;
  leaseEndDate: string | null;
  contractHistory: ContractHistoryItem[];
  tenantContact: TenantContact | null;
};

type PastRental = {
  id: string;
  tenantName: string;
  leaseEndDate: string | null;
  createdAt: string;
  obligationsCount: number;
};

type Props = {
  workspaceId:     string;
  workspaceName:   string;
  unit:            Unit | null;
  whatsappEnabled: boolean;
  ownerPhone:      string | null;
  pastRentals:     PastRental[];
};

async function apiFetch(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Error en el servidor");
  return data;
}

export function WorkspaceSettings({
  workspaceId,
  workspaceName,
  unit,
  whatsappEnabled,
  ownerPhone,
  pastRentals,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function refresh() { startTransition(() => router.refresh()); }
  function redirectDashboard() { router.push("/dashboard"); router.refresh(); }

  return (
    <div>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.82rem",
          fontWeight: 500,
          color: "#6b7280",
          background: "#f3f4f6",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: "8px",
          padding: "0.42rem 0.85rem",
          cursor: "pointer",
          letterSpacing: "-0.01em",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7 1.5V2.5M7 11.5V12.5M1.5 7H2.5M11.5 7H12.5M3.1 3.1l.7.7M10.2 10.2l.7.7M10.9 3.1l-.7.7M3.8 10.2l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        Configuración
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "#f2f2f7",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.025em" }}>
                Configuración
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#e5e7eb",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#6b7280",
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: "auto", padding: "1.25rem", display: "grid", gap: "1.75rem" }}>

              {/* Casita name + delete */}
              <GroupSection label="Casita">
                <WorkspaceNameEditor
                  workspaceId={workspaceId}
                  currentName={workspaceName}
                  onSave={refresh}
                  onDelete={redirectDashboard}
                />
              </GroupSection>

              {/* Inquilino — flat, no property/unit nesting */}
              {unit && (
                <GroupSection label="Inquilino">
                  <TenantEditor unit={unit} onSave={refresh} />
                </GroupSection>
              )}

              {/* Contrato & vencimiento */}
              {unit && (
                <GroupSection label="Contrato">
                  <ContractSection unit={unit} onSave={refresh} />
                </GroupSection>
              )}

              {/* Terminar alquiler */}
              {unit && (
                <GroupSection label="Alquiler activo">
                  <EndRentalSection unitId={unit.id} onEnded={refresh} />
                </GroupSection>
              )}

              {/* Alquileres anteriores */}
              {pastRentals.length > 0 && (
                <GroupSection label="Alquileres anteriores">
                  <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                    {pastRentals.map((r, i) => (
                      <div key={r.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0.75rem 1rem", gap: "0.75rem",
                        borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : "none",
                      }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#1c1c1e" }}>
                            {r.tenantName}
                          </p>
                          <p style={{ margin: "1px 0 0", fontSize: "0.72rem", color: "#8e8e93" }}>
                            Desde {new Date(r.createdAt).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
                            {r.leaseEndDate && ` hasta ${new Date(r.leaseEndDate).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}`}
                            {" · "}{r.obligationsCount} cobros
                          </p>
                        </div>
                        <span style={{ fontSize: "0.68rem", color: "#8e8e93", background: "#f2f2f7", padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
                          Archivado
                        </span>
                      </div>
                    ))}
                  </div>
                </GroupSection>
              )}

              {/* Integraciones */}
              <GroupSection label="Integraciones">
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <SubGroup label="Casita por WhatsApp">
                    <WhatsAppOwnerOnboarding
                      workspaceId={workspaceId}
                      ownerPhone={ownerPhone}
                      casitaWhatsAppNumber={process.env.NEXT_PUBLIC_TWILIO_WHATSAPP_FROM ?? "+14155238886"}
                      onSaved={refresh}
                    />
                  </SubGroup>
                  <SubGroup label="WhatsApp inquilinos">
                    <WhatsAppSettings
                      workspaceId={workspaceId}
                      enabled={whatsappEnabled}
                      onSaved={refresh}
                    />
                  </SubGroup>
                </div>
              </GroupSection>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section helpers ─────────────────────────────────────────────── */

function GroupSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </p>
        {action}
      </div>
      <div style={{
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid rgba(0,0,0,0.07)",
        overflow: "hidden",
        padding: "0.9rem 1rem",
      }}>
        {children}
      </div>
    </div>
  );
}

function SubGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", fontWeight: 600, color: "#1c1c1e", letterSpacing: "-0.01em" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Workspace name editor + delete ─────────────────────────────── */
function WorkspaceNameEditor({
  workspaceId,
  currentName,
  onSave,
  onDelete,
}: {
  workspaceId: string;
  currentName: string;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [name, setName]         = useState(currentName);
  const [busy, setBusy]         = useState(false);
  const [editing, setEditing]   = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  async function save() {
    if (name === currentName) { setEditing(false); return; }
    setBusy(true);
    await apiFetch(`/api/workspaces/${workspaceId}`, "PATCH", { name });
    setBusy(false);
    setEditing(false);
    onSave();
  }

  async function del() {
    setBusy(true);
    await apiFetch(`/api/workspaces/${workspaceId}`, "DELETE");
    onDelete();
  }

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <SettingsRow label="Nombre">
        {editing ? (
          <InlineInput value={name} onChange={setName} onSave={save} onCancel={() => setEditing(false)} busy={busy} />
        ) : (
          <RowValue value={name} onEdit={() => setEditing(true)} />
        )}
      </SettingsRow>

      {/* Danger zone */}
      <div style={{
        padding: "0.75rem",
        background: "#fef2f2",
        border: "1px solid rgba(220,38,38,0.15)",
        borderRadius: "10px",
      }}>
        <p style={{ margin: "0 0 0.3rem", fontSize: "0.75rem", fontWeight: 700, color: "#dc2626" }}>
          Zona de peligro
        </p>
        <p style={{ margin: "0 0 0.6rem", fontSize: "0.73rem", color: "#dc2626", lineHeight: 1.5, opacity: 0.85 }}>
          Eliminar la casita borra todas sus propiedades, unidades, inquilinos y obligaciones. Esta acción no se puede deshacer.
        </p>
        {delConfirm ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={del} style={{ ...dangerBtnStyle, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Eliminando…" : "Sí, eliminar casita"}
            </button>
            <button type="button" onClick={() => setDelConfirm(false)} style={cancelBtnStyle}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" style={dangerBtnStyle} onClick={() => setDelConfirm(true)}>
            Eliminar casita
          </button>
        )}
      </div>
    </div>
  );
}


/* ── Tenant editor (flat) ────────────────────────────────────────── */
function TenantEditor({ unit, onSave }: { unit: Unit; onSave: () => void }) {
  const [editing, setEditing]     = useState(false);
  const [tenantName, setTenantName]   = useState(unit.tenantContact?.fullName ?? "");
  const [tenantEmail, setTenantEmail] = useState(unit.tenantContact?.email ?? "");
  const [tenantPhone, setTenantPhone] = useState(unit.tenantContact?.whatsapp ?? "");
  const [busy, setBusy]           = useState(false);

  async function save() {
    setBusy(true);
    if (unit.tenantContact) {
      await apiFetch(`/api/tenant-contacts/${unit.tenantContact.id}`, "PATCH", {
        fullName: tenantName, email: tenantEmail, whatsapp: tenantPhone,
      });
    } else {
      await apiFetch("/api/tenant-contacts", "POST", {
        unitId: unit.id, fullName: tenantName, email: tenantEmail, whatsapp: tenantPhone,
      });
    }
    setBusy(false);
    setEditing(false);
    onSave();
  }

  async function remove() {
    if (!unit.tenantContact) return;
    setBusy(true);
    await apiFetch(`/api/tenant-contacts/${unit.tenantContact.id}`, "DELETE");
    setBusy(false);
    onSave();
  }

  if (editing) {
    return (
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <input autoFocus className="field" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Nombre completo" style={{ fontSize: "0.83rem" }} />
        <input className="field" type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="Email (opcional)" style={{ fontSize: "0.83rem" }} />
        <input className="field" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="Teléfono WhatsApp (opcional)" style={{ fontSize: "0.83rem" }} />
        <SaveCancel onSave={save} onCancel={() => setEditing(false)} busy={busy} />
      </div>
    );
  }

  if (unit.tenantContact) {
    return (
      <div style={{ display: "grid", gap: "0.55rem" }}>
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <SettingsRow label="Nombre">
            <RowValue value={unit.tenantContact.fullName} onEdit={() => setEditing(true)} />
          </SettingsRow>
          {unit.tenantContact.email && (
            <SettingsRow label="Email">
              <RowValue value={unit.tenantContact.email} onEdit={() => setEditing(true)} />
            </SettingsRow>
          )}
          {unit.tenantContact.whatsapp && (
            <SettingsRow label="WhatsApp">
              <RowValue value={unit.tenantContact.whatsapp} onEdit={() => setEditing(true)} />
            </SettingsRow>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button type="button" onClick={() => setEditing(true)} style={{ ...cancelBtnStyle, fontSize: "0.75rem" }}>Editar</button>
          <DeleteBtn label="Quitar inquilino" onConfirm={remove} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#8e8e93", fontStyle: "italic" }}>Sin inquilino asignado</p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.3rem",
          fontSize: "0.78rem", fontWeight: 600, color: "#059669",
          background: "#ecfdf5", border: "1px solid rgba(5,150,105,0.2)",
          borderRadius: "8px", padding: "0.4rem 0.75rem", cursor: "pointer",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Agregar inquilino
      </button>
    </div>
  );
}

/* ── Contract section (flat) ─────────────────────────────────────── */
function ContractSection({ unit, onSave }: { unit: Unit; onSave: () => void }) {
  const [editingLease, setEditingLease]           = useState(false);
  const [leaseDate, setLeaseDate]                 = useState(unit.leaseEndDate ? unit.leaseEndDate.slice(0, 10) : "");
  const [leaseBusy, setLeaseBusy]                 = useState(false);
  const [contractUploading, setContractUploading] = useState(false);
  const [contractMsg, setContractMsg]             = useState<string | null>(null);
  const [contractUrl, setContractUrl]             = useState(unit.contractUrl);
  const [showHistory, setShowHistory]             = useState(false);
  const [history, setHistory]                     = useState<ContractHistoryItem[]>(unit.contractHistory);

  async function saveLease() {
    setLeaseBusy(true);
    await apiFetch(`/api/units/${unit.id}`, "PATCH", {
      leaseEndDate: leaseDate ? new Date(leaseDate + "T00:00:00").toISOString() : null,
    });
    setLeaseBusy(false);
    setEditingLease(false);
    onSave();
  }

  async function uploadContract(file: File) {
    setContractUploading(true);
    setContractMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/units/${unit.id}/contract`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir");
      setContractUrl(data.contractUrl);
      setHistory((prev) => [{ id: Date.now().toString(), url: data.contractUrl, uploadedAt: new Date().toISOString() }, ...prev]);
      setContractMsg("Contrato guardado.");
      onSave();
    } catch (err) {
      setContractMsg(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setContractUploading(false);
    }
  }

  const leaseLabel = unit.leaseEndDate
    ? new Date(unit.leaseEndDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  const expiringSoon = unit.leaseEndDate
    ? (new Date(unit.leaseEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 60
    : false;

  return (
    <div style={{ display: "grid", gap: "0.9rem" }}>
      {/* Lease end date */}
      <div>
        <p style={{ margin: "0 0 0.4rem", fontSize: "0.69rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Fin del contrato
        </p>
        {!editingLease ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {leaseLabel ? (
              <span style={{
                fontSize: "0.85rem", fontWeight: 600,
                color: expiringSoon ? "#b45309" : "#1c1c1e",
                background: expiringSoon ? "#fffbeb" : "transparent",
                padding: expiringSoon ? "0.15rem 0.5rem" : undefined,
                borderRadius: expiringSoon ? "6px" : undefined,
              }}>
                {leaseLabel}{expiringSoon ? " ⚠" : ""}
              </span>
            ) : (
              <span style={{ fontSize: "0.8rem", color: "#8e8e93", fontStyle: "italic" }}>No definido</span>
            )}
            <button
              type="button"
              onClick={() => setEditingLease(true)}
              style={{ ...cancelBtnStyle, fontSize: "0.73rem", padding: "0.25rem 0.55rem" }}
            >
              {leaseLabel ? "Cambiar" : "Definir fecha"}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <input autoFocus type="date" className="field" value={leaseDate} onChange={(e) => setLeaseDate(e.target.value)} style={{ fontSize: "0.85rem" }} />
            <SaveCancel onSave={saveLease} onCancel={() => setEditingLease(false)} busy={leaseBusy} />
          </div>
        )}
      </div>

      {/* Contract file */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <p style={{ margin: 0, fontSize: "0.69rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Archivo del contrato
          </p>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "0.73rem", fontWeight: 600, color: "#059669",
            cursor: contractUploading ? "not-allowed" : "pointer",
            opacity: contractUploading ? 0.5 : 1,
            padding: "0.2rem 0.5rem",
            background: "#ecfdf5", borderRadius: "6px",
            border: "1px solid rgba(5,150,105,0.15)",
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v6M2 4.5L5 1l3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {contractUploading ? "Subiendo…" : contractUrl ? "Reemplazar" : "Subir contrato"}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              style={{ display: "none" }}
              disabled={contractUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContract(f); e.target.value = ""; }}
            />
          </label>
        </div>

        {contractUrl ? (
          <a
            href={contractUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              fontSize: "0.78rem", color: "#059669", fontWeight: 500, textDecoration: "none",
              padding: "0.45rem 0.6rem", background: "#f0fdf4",
              borderRadius: "8px", border: "1px solid rgba(5,150,105,0.12)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2 2h5l3 3v5H2V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M7 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            Ver contrato vigente
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginLeft: "auto", opacity: 0.5 }}>
              <path d="M1 7L7 1M7 1H3M7 1v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </a>
        ) : (
          <p style={{ margin: 0, fontSize: "0.76rem", color: "#8e8e93", fontStyle: "italic" }}>Sin contrato cargado</p>
        )}

        {contractMsg && (
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", color: contractMsg.includes("ardado") ? "#059669" : "#dc2626" }}>
            {contractMsg}
          </p>
        )}

        {history.length > 1 && (
          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              style={{ background: "none", border: "none", padding: 0, fontSize: "0.72rem", color: "#8e8e93", cursor: "pointer", fontWeight: 500 }}
            >
              {showHistory ? "▲ Ocultar historial" : `▼ Versiones anteriores (${history.length - 1})`}
            </button>
            {showHistory && (
              <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.2rem" }}>
                {history.slice(1).map((h, i) => (
                  <a key={h.id} href={h.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "#6b7280", textDecoration: "none" }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2h4l2 2.5V9H2V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                    Versión {history.length - 1 - i} · {new Date(h.uploadedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared UI primitives ────────────────────────────────────────── */

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.75rem", color: "#8e8e93", fontWeight: 500, minWidth: "76px", letterSpacing: "-0.01em" }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function RowValue({ value, onEdit, muted }: { value: string; onEdit: () => void; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={{ fontSize: "0.85rem", color: muted ? "#8e8e93" : "#1c1c1e", fontStyle: muted ? "italic" : "normal", letterSpacing: "-0.01em" }}>
        {value}
      </span>
      <button
        type="button"
        title="Editar"
        onClick={onEdit}
        style={{ display: "inline-flex", alignItems: "center", padding: "0.15rem", background: "none", border: "none", color: "#c7c7cc", cursor: "pointer", borderRadius: "4px" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M8 1.5L10.5 4 4.5 10H2V7.5L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

function InlineInput({
  value, onChange, onSave, onCancel, busy,
}: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", flex: 1 }}>
      <input
        autoFocus
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        style={{ fontSize: "0.85rem", flex: 1 }}
      />
      <SaveCancel onSave={onSave} onCancel={onCancel} busy={busy} inline />
    </div>
  );
}

function SaveCancel({ onSave, onCancel, busy, inline }: { onSave: () => void; onCancel: () => void; busy: boolean; inline?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "0.35rem" }}>
      <button
        type="button"
        className="btn-primary"
        onClick={onSave}
        disabled={busy}
        style={{ fontSize: inline ? "0.78rem" : "0.82rem", padding: inline ? "0.35rem 0.65rem" : "0.45rem 0.8rem" }}
      >
        {busy ? "…" : "Guardar"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ ...cancelBtnStyle, fontSize: inline ? "0.78rem" : "0.82rem", padding: inline ? "0.35rem 0.65rem" : "0.45rem 0.8rem" }}
      >
        Cancelar
      </button>
    </div>
  );
}

function DeleteBtn({ label, onConfirm }: { label: string; onConfirm: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
    setConfirm(false);
  }

  return confirm ? (
    <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
      <button type="button" onClick={handle} disabled={busy} style={{ ...dangerBtnStyle, fontSize: "0.72rem" }}>
        {busy ? "…" : "Confirmar"}
      </button>
      <button type="button" onClick={() => setConfirm(false)} style={{ ...cancelBtnStyle, fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}>
        No
      </button>
    </div>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} style={{ ...dangerBtnStyle, fontSize: "0.72rem" }}>
      {label}
    </button>
  );
}

function IconBtn({
  children, onClick, title, danger, accent,
}: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean; accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "26px",
        height: "26px",
        borderRadius: "6px",
        border: "1px solid",
        borderColor: danger ? "rgba(220,38,38,0.2)" : accent ? "rgba(5,150,105,0.2)" : "rgba(0,0,0,0.08)",
        background: danger ? "#fef2f2" : accent ? "#ecfdf5" : "#f3f4f6",
        color: danger ? "#dc2626" : accent ? "#059669" : "#6b7280",
        cursor: "pointer",
        padding: 0,
        transition: "all 0.12s",
      }}
    >
      {children}
    </button>
  );
}

const dangerBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.38rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid rgba(220,38,38,0.2)",
  background: "#fef2f2",
  color: "#dc2626",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.38rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid rgba(0,0,0,0.08)",
  background: "#f3f4f6",
  color: "#6b7280",
  fontWeight: 500,
  fontSize: "0.8rem",
  cursor: "pointer",
};

/* ── End Rental Section ──────────────────────────────────────────── */
function EndRentalSection({ unitId, onEnded }: { unitId: string; onEnded: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleEnd() {
    setBusy(true);
    const res = await fetch(`/api/units/${unitId}/end-rental`, { method: "POST" });
    setBusy(false);
    if (res.ok) { setDone(true); setTimeout(onEnded, 1200); }
    else setConfirm(false);
  }

  if (done) {
    return (
      <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "1rem", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#059669" }}>
          ✓ Alquiler terminado. El historial quedó archivado.
        </p>
      </div>
    );
  }

  if (confirm) {
    return (
      <div style={{ background: "#fef2f2", borderRadius: "12px", border: "1px solid #fca5a5", padding: "1rem", display: "grid", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "#1c1c1e", fontWeight: 600 }}>
          ¿Confirmás que terminó el alquiler?
        </p>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280", lineHeight: 1.5 }}>
          La casita quedará libre y el historial del inquilino se va a archivar. Esta acción no se puede deshacer.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <button type="button" onClick={() => setConfirm(false)} style={{ background: "#f2f2f7", border: "none", borderRadius: "10px", padding: "0.65rem", fontSize: "0.85rem", fontWeight: 600, color: "#1c1c1e", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="button" onClick={handleEnd} disabled={busy} style={{ background: "#dc2626", border: "none", borderRadius: "10px", padding: "0.65rem", fontSize: "0.85rem", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            {busy ? "Terminando…" : "Sí, terminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.07)", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
      <div>
        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#1c1c1e" }}>Terminar alquiler</p>
        <p style={{ margin: "2px 0 0", fontSize: "0.73rem", color: "#8e8e93" }}>
          El inquilino se va. Archivá este alquiler para liberar la casita.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        style={{ flexShrink: 0, fontSize: "0.8rem", fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "0.4rem 0.85rem", cursor: "pointer" }}
      >
        Terminar
      </button>
    </div>
  );
}
