"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ObligationTypePicker, TYPE_META, type ObligationTypeValue } from "@/components/obligation-type-picker";
import { ProviderPicker } from "@/components/provider-picker";
import type { ServiceType } from "@/lib/providers";

type Template = {
  id: string;
  type: string;
  title: string;
  currency: string;
  amount: string;
  dueDay: number;
  providerSlug:    string | null;
  ingestionMode:   string;
  billingPeriod:   string;
  reminderDays:    number;
  reminderChannel: string;
  paymentMethod:   string | null;
  paymentCbu:      string | null;
  paymentName:     string | null;
  paymentMpLink:   string | null;
};

type Mode = "idle" | "edit" | "increase";

type MonthlyObligation = {
  id: string;
  templateId: string | null;
  status: string;
  amount: string;
  dueDate: string;
  dueMonth: string | null;
  originalBillUrl: string | null;
  proofUrl: string | null;
};

type Props = {
  unitId: string;
  workspaceId: string;
  emailConnected: boolean;
  templates: Template[];
  obligations?: MonthlyObligation[];
  leaseEndDate?: string | null;
  unitCreatedAt?: string | null;
  tenantName?: string | null;
};

/* Returns "YYYY-MM" for a UTC Date */
function mKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export function UnitEditor({ unitId, workspaceId, emailConnected, templates, obligations = [], leaseEndDate, unitCreatedAt, tenantName }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  /* ── "Add new" form ──────────────────────────────────────────── */
  const [addOpen, setAddOpen]         = useState(false);
  const [addStep, setAddStep]         = useState(1);
  const [newType, setNewType]         = useState<ObligationTypeValue>("expensas");
  const [newCur, setNewCur]           = useState<"ARS" | "USD">("ARS");
  const [newIngestionMode, setNewIngestionMode] = useState<"manual" | "auto_email">("manual");
  const [newAmt, setNewAmt]           = useState("");
  const [newDay, setNewDay]           = useState("10");
  const [newProviderSlug,    setNewProviderSlug]    = useState<string | null>(null);
  const [newBillingPeriod,   setNewBillingPeriod]   = useState("monthly");
  const [newReminderDays,    setNewReminderDays]     = useState("3");
  const [newReminderChannel, setNewReminderChannel]  = useState("email");
  const [newRemindBefore,    setNewRemindBefore]     = useState(true);
  const [newRemindOnDue,     setNewRemindOnDue]      = useState(true);
  const [newRemindOverdue,   setNewRemindOverdue]    = useState(true);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [addBusy, setAddBusy]         = useState(false);
  const [addErr, setAddErr]           = useState<string | null>(null);
  const [addedThisSession, setAddedThisSession] = useState<string[]>([]);

  /* ── Per-template action mode ────────────────────────────────── */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode]         = useState<Mode>("idle");

  /* edit fields */
  const [editAmt, setEditAmt]                     = useState("");
  const [editDay, setEditDay]                     = useState("");
  const [editCur, setEditCur]                     = useState<"ARS" | "USD">("ARS");
  const [editIngestionMode, setEditIngestionMode] = useState<"manual" | "auto_email">("manual");
  const [editProviderSlug,  setEditProviderSlug]  = useState<string | null>(null);
  const [editBillingPeriod, setEditBillingPeriod] = useState("monthly");
  const [editReminderDays,    setEditReminderDays]    = useState("3");
  const [editReminderChannel, setEditReminderChannel] = useState("email");
  const [editPaymentMethod,   setEditPaymentMethod]   = useState<"cbu" | "mp_link" | null>(null);
  const [editPaymentCbu,      setEditPaymentCbu]      = useState("");
  const [editPaymentName,     setEditPaymentName]     = useState("");
  const [editPaymentMpLink,   setEditPaymentMpLink]   = useState("");

  /* increase fields */
  const [incrAmt, setIncrAmt]       = useState("");
  const [incrPct, setIncrPct]       = useState("");
  const [incrBusy, setIncrBusy]     = useState(false);
  const [incrDoneFor, setIncrDoneFor] = useState<string | null>(null);

  /* verify payment */
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  /* ── Month navigation ────────────────────────────────────────── */
  const nowUTC = new Date();
  const currentMonthDate = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), 1));
  const [selectedMonth, setSelectedMonth] = useState<Date>(currentMonthDate);

  const leaseEnd = leaseEndDate ? new Date(leaseEndDate) : null;
  const maxMonth = leaseEnd
    ? new Date(Date.UTC(leaseEnd.getUTCFullYear(), leaseEnd.getUTCMonth(), 1))
    : addMonths(currentMonthDate, 12);

  /* Can't go back further than the month the casita was created */
  const minMonth = unitCreatedAt
    ? mKey(new Date(unitCreatedAt))
    : mKey(currentMonthDate);

  const canPrev = mKey(selectedMonth) > minMonth;
  const canNext = mKey(selectedMonth) < mKey(maxMonth);
  const isCurrentMonth = mKey(selectedMonth) === mKey(currentMonthDate);

  function goMonth(delta: number) {
    const next = addMonths(selectedMonth, delta);
    if (delta < 0 && !canPrev) return;
    if (delta > 0 && !canNext) return;
    setSelectedMonth(next);
  }

  /* Swipe handling */
  const swipeStartX = { current: 0 };
  function onTouchStart(e: React.TouchEvent) { swipeStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) > 40) goMonth(dx < 0 ? 1 : -1);
  }

  /* Obligations indexed by templateId for the selected month */
  const selectedKey = mKey(selectedMonth);
  const obligationMapForMonth = new Map<string, MonthlyObligation>();
  for (const o of obligations) {
    if (o.templateId && o.dueMonth && o.dueMonth.startsWith(selectedKey)) {
      obligationMapForMonth.set(o.templateId, o);
    }
  }

  const isFuture = mKey(selectedMonth) > mKey(currentMonthDate);
  const isPast = mKey(selectedMonth) < mKey(currentMonthDate);

  function refresh() { startTransition(() => router.refresh()); }

  async function onVerify(obligationId: string) {
    setVerifyingId(obligationId);
    try {
      const res = await fetch(`/api/obligations/${obligationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "verified" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[onVerify] error", data);
      }
      refresh();
    } catch (err) {
      console.error("[onVerify]", err);
    } finally {
      setVerifyingId(null);
    }
  }

  function openEdit(t: Template) {
    setActiveId(t.id);
    setMode("edit");
    setEditAmt(t.amount);
    setEditDay(String(t.dueDay));
    setEditCur(t.currency as "ARS" | "USD");
    setEditIngestionMode((t.ingestionMode as "manual" | "auto_email") ?? "manual");
    setEditProviderSlug(t.providerSlug);
    setEditBillingPeriod(t.billingPeriod ?? "monthly");
    setEditReminderDays(String(t.reminderDays));
    setEditReminderChannel(t.reminderChannel);
    setEditPaymentMethod((t.paymentMethod as "cbu" | "mp_link" | null) ?? null);
    setEditPaymentCbu(t.paymentCbu ?? "");
    setEditPaymentName(t.paymentName ?? "");
    setEditPaymentMpLink(t.paymentMpLink ?? "");
  }

  function openIncrease(t: Template) {
    setActiveId(t.id);
    setMode("increase");
    setIncrAmt("");
    setIncrPct("");
  }

  function closeActive() { setActiveId(null); setMode("idle"); }

  async function runEmailScanNow() {
    setScanBusy(true);
    setScanMsg(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/fetch-bills-now`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo buscar facturas");
      setScanMsg(`Búsqueda completada: ${data.processed ?? 0} factura(s) encontrada(s).`);
      refresh();
    } catch (err) {
      setScanMsg(err instanceof Error ? err.message : "No se pudo buscar facturas");
    } finally {
      setScanBusy(false);
    }
  }

  /* ── Patch helper ────────────────────────────────────────────── */
  async function patch(id: string, body: object) {
    return fetch(`/api/obligation-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /* ── Save edit ───────────────────────────────────────────────── */
  async function onSaveEdit(id: string) {
    setIncrBusy(true);
    await patch(id, {
      currency:        editCur,
      amount:          Number(editAmt),
      dueDay:          Number(editDay),
      ingestionMode:   editIngestionMode,
      providerSlug:    editProviderSlug,
      billingPeriod:   editBillingPeriod,
      reminderDays:    Number(editReminderDays),
      reminderChannel: editReminderChannel,
      paymentMethod:   editPaymentMethod,
      paymentCbu:      editPaymentMethod ? (editPaymentCbu  || null) : null,
      paymentName:     editPaymentMethod ? (editPaymentName || null) : null,
      paymentMpLink:   null,
    });
    setIncrBusy(false);
    closeActive();
    refresh();
  }

  /* ── Save increase ───────────────────────────────────────────── */
  async function onSaveIncrease(id: string) {
    if (!incrAmt) return;
    setIncrBusy(true);
    await patch(id, { amount: Number(incrAmt) });
    setIncrBusy(false);
    setIncrDoneFor(id);
    closeActive();
    refresh();
    setTimeout(() => setIncrDoneFor(null), 2500);
  }

  /* ── Deactivate ──────────────────────────────────────────────── */
  async function onDeactivate(id: string) {
    await patch(id, { isActive: false });
    closeActive();
    refresh();
  }

  /* ── Add new template ────────────────────────────────────────── */
  function resetAddFields() {
    setNewType("expensas");
    setNewCur("ARS");
    setNewIngestionMode("manual");
    setNewAmt("");
    setNewDay("10");
    setNewProviderSlug(null);
    setNewBillingPeriod("monthly");
    setNewReminderDays("3");
    setNewReminderChannel("email");
    setAddStep(1);
    setAddErr(null);
  }

  async function saveNewTemplate(keepOpen: boolean) {
    if (newIngestionMode === "auto_email" && !emailConnected) {
      setAddErr("Para automatizar este cobro primero conectá tu email.");
      return;
    }
    setAddBusy(true);
    setAddErr(null);
    const res = await fetch("/api/obligation-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        type: newType,
        currency: newCur,
        amount: newAmt ? Number(newAmt) : 0,
        dueDay: Number(newDay),
        ingestionMode: newIngestionMode,
        providerSlug: newProviderSlug,
        billingPeriod: newBillingPeriod,
        reminderDays: Number(newReminderDays),
        reminderChannel: newReminderChannel,
        remindBefore: newRemindBefore,
        remindOnDue: newRemindOnDue,
        remindOverdue: newRemindOverdue,
      }),
    });
    const data = await res.json().catch(() => null);
    setAddBusy(false);
    if (!res.ok) { setAddErr(data?.error?.formErrors?.join(", ") ?? data?.error ?? "No se pudo guardar"); return; }
    setAddedThisSession((prev) => [
      `${typeLabel(newType)} · día ${newDay}${newAmt ? ` · ${fmtAmt(newAmt, newCur)}` : " · sin monto"}`,
      ...prev.slice(0, 2),
    ]);
    if (keepOpen) {
      resetAddFields();
    } else {
      setAddOpen(false);
      resetAddFields();
      setAddedThisSession([]);
    }
    refresh();
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    await saveNewTemplate(false);
  }

  const typeLabel = (v: string) => TYPE_META[v as ObligationTypeValue]?.label ?? v;
  const isServiceType = newType !== "rent";

  function resetAddWizard() {
    setAddOpen(false);
    resetAddFields();
    setAddedThisSession([]);
  }

  function canContinueStep(step: number) {
    if (step === 1) return true;
    if (step === 2) {
      if (newIngestionMode === "manual") return true;
      if (!emailConnected) return false;
      if (isServiceType && !newProviderSlug) return false;
      return true;
    }
    if (step === 3) {
      if (!Boolean(newDay)) return false;
      if (newType === "rent") return Boolean(newAmt);
      return true;
    }
    if (step === 4) return true;
    return true;
  }

  function goNextStep() {
    if (addStep < 4) setAddStep((s) => s + 1);
  }

  function goPrevStep() {
    if (addStep > 1) setAddStep((s) => s - 1);
  }

  function fmtAmt(amt: string, cur: string) {
    if (cur === "USD") return `U$D ${Number(amt).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
    return `$ ${Number(amt).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  /* derived: pct → amt and amt → pct for increase form */
  function onIncrPctChange(t: Template, val: string) {
    setIncrPct(val);
    if (val && !isNaN(Number(val))) {
      const newVal = Number(t.amount) * (1 + Number(val) / 100);
      setIncrAmt(String(Math.round(newVal)));
    }
  }
  function onIncrAmtChange(t: Template, val: string) {
    setIncrAmt(val);
    if (val && !isNaN(Number(val)) && Number(t.amount) > 0) {
      const pct = ((Number(val) - Number(t.amount)) / Number(t.amount)) * 100;
      setIncrPct(pct.toFixed(1));
    }
  }

  const CHANNEL_LABEL: Record<string, string> = {
    email:    "email",
    whatsapp: "WhatsApp",
    both:     "email + WhatsApp",
    none:     "",
  };

  const selectedMonthLabel = selectedMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div style={{ display: "grid", gap: "0" }}>

      {/* ── Month navigator header ────────────────────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.85rem 1.1rem 0.7rem",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          userSelect: "none",
        }}
      >
        {/* Prev arrow */}
        <button
          type="button"
          onClick={() => goMonth(-1)}
          disabled={!canPrev}
          style={{
            width: "32px", height: "32px", borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.1)",
            background: canPrev ? "#fff" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: canPrev ? "pointer" : "default",
            color: canPrev ? "#1c1c1e" : "#d1d5db",
            flexShrink: 0,
          }}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
            <path d="M6.5 1L1.5 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Month + context */}
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em", textTransform: "capitalize" }}>
            {selectedMonthLabel}
          </p>
          <p style={{ margin: "1px 0 0", fontSize: "0.68rem", color: isCurrentMonth ? "#059669" : isPast ? "#8e8e93" : "#6b7280", fontWeight: 500 }}>
            {isCurrentMonth ? "Este mes" : isPast ? "Historial" : leaseEnd && mKey(selectedMonth) === mKey(maxMonth) ? "Último mes del contrato" : "Próximo"}
          </p>
        </div>

        {/* Next arrow */}
        <button
          type="button"
          onClick={() => goMonth(1)}
          disabled={!canNext}
          style={{
            width: "32px", height: "32px", borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.1)",
            background: canNext ? "#fff" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: canNext ? "pointer" : "default",
            color: canNext ? "#1c1c1e" : "#d1d5db",
            flexShrink: 0,
          }}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
            <path d="M1.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Charge list for selected month ───────────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ padding: "0.65rem 1.1rem", display: "grid", gap: "0.55rem" }}
      >
        {templates.length === 0 && (
          <div style={{ padding: "1.5rem 1rem", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#8e8e93" }}>Sin cobros configurados</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.76rem", color: "#aeaeb2" }}>
              Usá el botón <strong>+ Agregar</strong> para definir alquiler, expensas o servicios.
            </p>
          </div>
        )}

      {/* ── Existing templates ────────────────────────────────────── */}
      {templates.map((t) => {
        const monthlyObligation = obligationMapForMonth.get(t.id) ?? null;
        const isVariable = t.type !== "rent";
        const hasBill = Boolean(monthlyObligation?.originalBillUrl);
        const isPaid = monthlyObligation?.status === "verified" || monthlyObligation?.status === "proof_uploaded";
        const isOverdue = monthlyObligation?.status === "overdue";

        return (
          <div key={t.id}>
            {/* ── Template card ── */}
            <div
              style={{
                background: incrDoneFor === t.id ? "#ecfdf5" : "#f9fafb",
                border: `1px solid ${isOverdue ? "#ffc9c7" : incrDoneFor === t.id ? "#a7f3d0" : "rgba(0,0,0,0.07)"}`,
                borderRadius: "0.75rem",
                transition: "background 0.3s",
                overflow: "hidden",
              }}
            >
              {/* Top row: name + action buttons */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.6rem 0.75rem 0.45rem", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: incrDoneFor === t.id ? "#059669" : "#1c1c1e", display: "block", letterSpacing: "-0.01em" }}>
                    {t.title}
                    {incrDoneFor === t.id && <span style={{ marginLeft: "0.4rem", color: "#059669", fontWeight: 600 }}>↑ actualizado</span>}
                  </span>
                  <span style={{ fontSize: "0.67rem", color: "#8e8e93" }}>
                    {typeLabel(t.type)} · vence día {t.dueDay}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  {t.type === "rent" && (
                    <ActionBtn onClick={() => openIncrease(t)} title="Registrar aumento" accent>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2.5 5.5M6 2L9.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700 }}>Aumento</span>
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={() => openEdit(t)} title="Editar">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 1.5L10.5 4 4.5 10H2V7.5L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  </ActionBtn>
                  <ActionBtn onClick={() => onDeactivate(t.id)} title="Desactivar" danger>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </ActionBtn>
                </div>
              </div>

              {/* Monthly status strip */}
              <div style={{
                borderTop: "1px solid rgba(0,0,0,0.06)",
                padding: "0.55rem 0.75rem",
                background: isFuture ? "#f9fafb" : isPaid ? "#f0fdf4" : isOverdue ? "#fef2f2" : isCurrentMonth && isVariable && !monthlyObligation ? "#fffbeb" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                  {/* Future month: show expected amount */}
                  {isFuture && (
                    <>
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                        {fmtAmt(t.amount, t.currency)} estimado
                      </span>
                      <span style={{
                        fontSize: "0.64rem", fontWeight: 600, padding: "0.12rem 0.4rem", borderRadius: "20px",
                        background: "#f3f4f6", color: "#9ca3af", border: "1px solid #e5e7eb",
                      }}>Próximo</span>
                    </>
                  )}

                  {/* Current or past month */}
                  {!isFuture && !monthlyObligation && isVariable && (
                    <span style={{ fontSize: "0.78rem", color: isPast ? "#9ca3af" : "#b45309", fontWeight: isPast ? 400 : 600 }}>
                      {isPast ? "Sin registro" : "Sin factura cargada"}
                    </span>
                  )}
                  {!isFuture && !monthlyObligation && !isVariable && (
                    <span style={{ fontSize: "0.78rem", color: "#8e8e93" }}>{fmtAmt(t.amount, t.currency)} · pendiente de confirmar</span>
                  )}
                  {!isFuture && monthlyObligation && (
                    <>
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: isOverdue ? "#dc2626" : isPaid ? "#059669" : "#1c1c1e", letterSpacing: "-0.02em" }}>
                        {fmtAmt(monthlyObligation.amount, t.currency)}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#8e8e93" }}>
                        vence {new Date(monthlyObligation.dueDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" })}
                      </span>
                      <span style={{
                        fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "20px",
                        background: isPaid ? "#dcfce7" : isOverdue ? "#fee2e2" : "#fff7ed",
                        color: isPaid ? "#059669" : isOverdue ? "#dc2626" : "#b45309",
                        border: `1px solid ${isPaid ? "#bbf7d0" : isOverdue ? "#fca5a5" : "#fed7aa"}`,
                      }}>
                        {isPaid ? (monthlyObligation.status === "proof_uploaded" ? "Comprobante subido" : "Pagado") : isOverdue ? "Vencida" : "Pendiente"}
                      </span>
                      {hasBill && (
                        <a href={monthlyObligation.originalBillUrl!} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: "0.68rem", color: "#6b7280", textDecoration: "underline" }}>
                          Ver boleta ↗
                        </a>
                      )}
                      {monthlyObligation.status === "proof_uploaded" && monthlyObligation.proofUrl && (
                        <a href={monthlyObligation.proofUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: "0.68rem", color: "#059669", textDecoration: "underline", fontWeight: 600 }}>
                          Ver comprobante ↗
                        </a>
                      )}
                    </>
                  )}
                </div>

                {/* Upload action — only current month, variable charges */}
                {!isFuture && isVariable && !monthlyObligation && isCurrentMonth && (
                  <TemplateBillButton templateId={t.id} templateTitle={t.title} templateType={t.type} unitId={unitId} />
                )}
                {!isFuture && isVariable && monthlyObligation && !hasBill && isCurrentMonth && (
                  <TemplateBillButton templateId={t.id} templateTitle={t.title} templateType={t.type} unitId={unitId} label="Subir boleta" />
                )}
                {!isFuture && isVariable && monthlyObligation && hasBill && !isPaid && (
                  <span style={{ fontSize: "0.68rem", color: "#059669", fontWeight: 600 }}>✓ Boleta cargada</span>
                )}
                {/* Verify CTA — appears when tenant uploaded proof, owner hasn't verified yet */}
                {!isFuture && monthlyObligation?.status === "proof_uploaded" && (
                  <button
                    onClick={() => onVerify(monthlyObligation.id)}
                    disabled={verifyingId === monthlyObligation.id}
                    style={{
                      fontSize: "0.72rem", fontWeight: 700,
                      padding: "0.3rem 0.65rem", borderRadius: "0.5rem",
                      border: "1.5px solid #059669",
                      background: verifyingId === monthlyObligation.id ? "#f0fdf4" : "#059669",
                      color: verifyingId === monthlyObligation.id ? "#059669" : "#fff",
                      cursor: verifyingId === monthlyObligation.id ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {verifyingId === monthlyObligation.id ? "Verificando…" : "✓ Verificar pago"}
                  </button>
                )}
              </div>
            </div>

            {/* ── Increase panel ── */}
          </div>
        );
      })}

      {/* ── Footer actions (current month only) ─────────────────── */}
      {isCurrentMonth && (
        <ExtraChargeButton unitId={unitId} onSaved={refresh} />
      )}
      </div>{/* end padding wrapper */}

      {/* ── Bottom toolbar: Agregar + current month indicator ─────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.6rem 1.1rem 0.85rem",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}>
        <span style={{ fontSize: "0.68rem", color: "#aeaeb2" }}>
          {templates.length} cobro{templates.length === 1 ? "" : "s"} configurado{templates.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "0.76rem", fontWeight: 600, color: "#059669",
            background: "#ecfdf5", border: "1px solid rgba(5,150,105,0.25)",
            borderRadius: "8px", padding: "0.35rem 0.75rem", cursor: "pointer",
          }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Agregar cobro recurrente
        </button>
      </div>

      {addOpen && (
        <div
          onClick={resetAddWizard}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.32)",
            zIndex: 70,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
        >
          <form
            onSubmit={onAdd}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "31rem",
              background: "#f2f2f7",
              borderRadius: "20px",
              border: "none",
              boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
              padding: "1.25rem 1.1rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: 0,
              height: "clamp(420px, 62dvh, 540px)",
            }}
          >
            {/* ── Fixed header ─────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", marginBottom: "0.9rem" }}>
              <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "#8e8e93", letterSpacing: "0.01em" }}>
                Paso {addStep} de 4
              </p>
              <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em", flex: 1, textAlign: "center" }}>
                Agregar cobro recurrente
              </p>
              <button
                type="button"
                onClick={resetAddWizard}
                style={{
                  background: "rgba(118,118,128,0.18)",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#636366",
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div style={{ height: "3px", background: "rgba(0,0,0,0.08)", borderRadius: "999px", overflow: "hidden", marginBottom: "1rem", flexShrink: 0 }}>
              <div
                style={{
                  height: "100%",
                  width: `${(addStep / 4) * 100}%`,
                  background: "var(--c-accent)",
                  borderRadius: "999px",
                  transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>

            <p style={{ margin: "0 0 0.75rem", fontSize: "0.74rem", color: "#8e8e93", textAlign: "center", flexShrink: 0 }}>
              Podés cargar todos los cobros que quieras ahora. Después también podés sumar más.
            </p>

            {addedThisSession.length > 0 && (
              <div style={{ marginBottom: "0.8rem", background: "#ecfdf5", border: "1px solid rgba(5,150,105,0.2)", borderRadius: "10px", padding: "0.5rem 0.65rem", flexShrink: 0 }}>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.68rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Ya agregaste
                </p>
                {addedThisSession.map((item, i) => (
                  <p key={`${item}-${i}`} style={{ margin: 0, fontSize: "0.75rem", color: "#2f5a46" }}>
                    • {item}
                  </p>
                ))}
              </div>
            )}

            {/* ── Scrollable step content (fills remaining height) ─── */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

              {addStep === 1 && (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  <p style={{ margin: "0 0 0.1rem 2px", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Tipo de cobro
                  </p>
                  <ObligationTypePicker
                    value={newType}
                    onChange={(v) => {
                      setNewType(v);
                      setNewProviderSlug(null);
                    }}
                  />
                </div>
              )}

              {addStep === 2 && (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  <p style={{ margin: "0 0 0.1rem 2px", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Registro de factura
                  </p>
                  <IngestionModePicker value={newIngestionMode} onChange={setNewIngestionMode} />

                  {newIngestionMode === "auto_email" && !emailConnected && (
                    <EmailConnectHint />
                  )}

                  {newIngestionMode === "auto_email" && emailConnected && (
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#374151" }}>
                        Casita buscará esta factura automáticamente según la frecuencia definida.
                      </p>
                      <div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={runEmailScanNow}
                          disabled={scanBusy}
                          style={{ fontSize: "0.76rem", padding: "0.35rem 0.75rem" }}
                        >
                          {scanBusy ? "Buscando..." : "Buscar facturas ahora"}
                        </button>
                      </div>
                      {scanMsg && <p style={{ margin: 0, fontSize: "0.73rem", color: "#374151" }}>{scanMsg}</p>}
                    </div>
                  )}

                  <BillingPeriodPicker value={newBillingPeriod} onChange={setNewBillingPeriod} />

                  {isServiceType && (
                    <ProviderPicker
                      type={newType as ServiceType}
                      value={newProviderSlug}
                      onChange={setNewProviderSlug}
                    />
                  )}
                </div>
              )}

              {addStep === 3 && (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  <p style={{ margin: "0 0 0.1rem 2px", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Monto y vencimiento
                  </p>
                  {newType !== "rent" && (
                    <p style={{ margin: 0, fontSize: "0.74rem", color: "#8e8e93" }}>
                      El monto puede quedar vacío por ahora. Cuando llegue la boleta del mes, lo cargás ahí.
                    </p>
                  )}
                  <SegmentedControl
                    options={[
                      { value: "ARS", label: "$ Pesos" },
                      { value: "USD", label: "U$D Dólares" },
                    ]}
                    value={newCur}
                    onChange={(v) => setNewCur(v as "ARS" | "USD")}
                  />
                  {/* Amount + day in an iOS card */}
                  <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 14px", minHeight: "48px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      <span style={{ fontSize: "0.88rem", color: "#1c1c1e", fontWeight: 500, minWidth: "72px" }}>
                        Monto{newType === "rent" ? " *" : ""}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={newType === "rent" ? (newCur === "ARS" ? "380000" : "500") : "Opcional"}
                        value={newAmt}
                        onChange={(e) => setNewAmt(e.target.value)}
                        required={newType === "rent"}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "0.9rem", textAlign: "right", color: "#1c1c1e", fontWeight: 500 }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 14px", minHeight: "48px" }}>
                      <span style={{ fontSize: "0.88rem", color: "#1c1c1e", fontWeight: 500, minWidth: "72px" }}>Día vence</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="10"
                        value={newDay}
                        onChange={(e) => setNewDay(e.target.value)}
                        required
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "0.9rem", textAlign: "right", color: "#1c1c1e", fontWeight: 500 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {addStep === 4 && (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  <p style={{ margin: "0 0 0.1rem 2px", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Avisos automáticos
                  </p>
                  <ReminderConfig
                    days={newReminderDays}
                    channel={newReminderChannel}
                    onDaysChange={setNewReminderDays}
                    onChannelChange={setNewReminderChannel}
                    remindBefore={newRemindBefore}
                    remindOnDue={newRemindOnDue}
                    remindOverdue={newRemindOverdue}
                    onRemindBeforeChange={setNewRemindBefore}
                    onRemindOnDueChange={setNewRemindOnDue}
                    onRemindOverdueChange={setNewRemindOverdue}
                    tenantName={tenantName ?? undefined}
                  />
                </div>
              )}

              {addErr && (
                <p
                  style={{
                    marginTop: "0.65rem",
                    fontSize: "0.8rem",
                    color: "var(--c-danger)",
                    background: "var(--c-danger-bg)",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "0.5rem",
                  }}
                >
                  {addErr}
                </p>
              )}

            </div>

            {/* ── Fixed nav footer ─────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.45rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(0,0,0,0.07)", marginTop: "0.75rem", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "0.45rem" }}>
                {addStep > 1 && (
                  <button type="button" className="btn-secondary" onClick={goPrevStep} style={{ fontSize: "0.8rem" }}>
                    ← Atrás
                  </button>
                )}
                {addStep < 4 && (
                  <button type="button" className="btn-secondary" onClick={goNextStep} style={{ fontSize: "0.8rem" }}>
                    Saltar
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.45rem" }}>
                {addStep < 4 ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={goNextStep}
                    disabled={!canContinueStep(addStep)}
                    style={{ fontSize: "0.8rem" }}
                  >
                    Continuar →
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={addBusy}
                      onClick={() => saveNewTemplate(true)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      {addBusy ? "Guardando…" : "Guardar y agregar otro"}
                    </button>
                    <button type="submit" className="btn-primary" disabled={addBusy} style={{ fontSize: "0.8rem" }}>
                      {addBusy ? "Guardando…" : "Guardar y cerrar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit modal (bottom sheet) ────────────────────────────────── */}
      {mode === "edit" && activeId && (() => {
        const t = templates.find((tmpl) => tmpl.id === activeId);
        if (!t) return null;
        return (
          <div onClick={closeActive} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#f2f2f7", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)", maxHeight: "90dvh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
                <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.15)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem 0.5rem" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Editar cobro</p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#8e8e93" }}>{typeLabel(t.type)}</p>
                </div>
                <button type="button" onClick={closeActive} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div style={{ padding: "0.5rem 1.25rem 2.5rem", display: "grid", gap: "0.75rem" }}>
                <div style={{ background: "#fff", borderRadius: "14px", padding: "1rem", display: "grid", gap: "0.75rem" }}>
                  <SegmentedControl
                    options={[{ value: "ARS", label: "$ Pesos" }, { value: "USD", label: "U$D" }]}
                    value={editCur}
                    onChange={(v) => setEditCur(v as "ARS" | "USD")}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Monto</label>
                      <input autoFocus className="field" type="number" placeholder="Ej: 380000" value={editAmt} onChange={(e) => setEditAmt(e.target.value)} style={{ fontSize: "0.9rem" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Día venc.</label>
                      <input className="field" type="number" min={1} max={31} value={editDay} onChange={(e) => setEditDay(e.target.value)} style={{ fontSize: "0.9rem" }} />
                    </div>
                  </div>
                </div>

                <IngestionModePicker value={editIngestionMode} onChange={setEditIngestionMode} />

                {editIngestionMode === "auto_email" && !emailConnected && (
                  <EmailConnectHint />
                )}

                {t.type !== "rent" && (
                  <>
                    <ProviderPicker type={t.type as ServiceType} value={editProviderSlug} onChange={setEditProviderSlug} />
                    {editIngestionMode === "auto_email" && (
                      <BillingPeriodPicker value={editBillingPeriod} onChange={setEditBillingPeriod} />
                    )}
                  </>
                )}

                <ReminderConfig
                  days={editReminderDays}
                  channel={editReminderChannel}
                  onDaysChange={setEditReminderDays}
                  onChannelChange={setEditReminderChannel}
                />

                {/* Payment method — only for rent */}
                {t.type === "rent" && (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Método de cobro
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {([{ id: "cbu", label: "CBU / Alias" }, { id: "mp_link", label: "Mercado Pago" }] as const).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setEditPaymentMethod(editPaymentMethod === id ? null : id)}
                          style={{
                            flex: 1, padding: "0.4rem 0.6rem", borderRadius: "8px",
                            border: `1.5px solid ${editPaymentMethod === id ? "#059669" : "rgba(0,0,0,0.1)"}`,
                            background: editPaymentMethod === id ? "#ecfdf5" : "#fff",
                            color: editPaymentMethod === id ? "#059669" : "#6b7280",
                            fontSize: "0.78rem", fontWeight: editPaymentMethod === id ? 700 : 500, cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {(editPaymentMethod === "cbu" || editPaymentMethod === "mp_link") && (
                      <div style={{ display: "grid", gap: "0.4rem" }}>
                        <input
                          className="field"
                          placeholder={editPaymentMethod === "mp_link" ? "Alias de Mercado Pago (ej: nombre.mp)" : "CBU o alias (ej: mialiasbank)"}
                          value={editPaymentCbu}
                          onChange={(e) => setEditPaymentCbu(e.target.value)}
                          style={{ fontSize: "0.88rem" }}
                        />
                        <input className="field" placeholder="Nombre y apellido del titular" value={editPaymentName} onChange={(e) => setEditPaymentName(e.target.value)} style={{ fontSize: "0.88rem" }} />
                      </div>
                    )}
                  </div>
                )}

                <button type="button" className="btn-primary" disabled={incrBusy} onClick={() => onSaveEdit(t.id)} style={{ width: "100%" }}>
                  {incrBusy ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Increase modal (bottom sheet) ───────────────────────────── */}
      {mode === "increase" && activeId && (() => {
        const t = templates.find((tmpl) => tmpl.id === activeId);
        if (!t) return null;
        return (
          <div onClick={closeActive} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#f2f2f7", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
                <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.15)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem 0.5rem" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>↑ Registrar aumento</p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#8e8e93" }}>Monto actual: <strong style={{ color: "#1c1c1e" }}>{fmtAmt(t.amount, t.currency)}</strong></p>
                </div>
                <button type="button" onClick={closeActive} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div style={{ padding: "0.5rem 1.25rem 2.5rem", display: "grid", gap: "0.75rem" }}>
                <div style={{ background: "#fff", borderRadius: "14px", padding: "1rem", display: "grid", gap: "0.7rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Nuevo monto ({t.currency})</label>
                      <input autoFocus className="field" type="number" step="1" min="0" placeholder="Ej: 450000" value={incrAmt} onChange={(e) => onIncrAmtChange(t, e.target.value)} style={{ fontSize: "0.9rem" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>% de aumento</label>
                      <input className="field" type="number" step="0.1" placeholder="Ej: 15" value={incrPct} onChange={(e) => onIncrPctChange(t, e.target.value)} style={{ fontSize: "0.9rem" }} />
                    </div>
                  </div>

                  {incrAmt && Number(incrAmt) > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.75rem", background: "#ecfdf5", borderRadius: "10px", fontSize: "0.82rem" }}>
                      <span style={{ color: "#6b7280" }}>{fmtAmt(t.amount, t.currency)}</span>
                      <span style={{ color: "#9ca3af" }}>→</span>
                      <span style={{ fontWeight: 800, color: "#059669", fontSize: "0.95rem" }}>{fmtAmt(incrAmt, t.currency)}</span>
                      {incrPct && (
                        <span style={{ marginLeft: "auto", fontWeight: 700, color: Number(incrPct) >= 0 ? "#059669" : "#dc2626", background: Number(incrPct) >= 0 ? "#d1fae5" : "#fef2f2", padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.74rem" }}>
                          {Number(incrPct) >= 0 ? "+" : ""}{Number(incrPct).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button type="button" className="btn-primary" disabled={incrBusy || !incrAmt} onClick={() => onSaveIncrease(t.id)} style={{ width: "100%" }}>
                  {incrBusy ? "Guardando…" : "Aplicar aumento"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

/* ── Small shared components ─────────────────────────────────────── */

/* ── Reminder config block ───────────────────────────────────────── */
function ReminderConfig({
  days,
  channel,
  onDaysChange,
  onChannelChange,
  remindBefore = true,
  remindOnDue = true,
  remindOverdue = true,
  onRemindBeforeChange,
  onRemindOnDueChange,
  onRemindOverdueChange,
  tenantName,
}: {
  days: string;
  channel: string;
  onDaysChange: (v: string) => void;
  onChannelChange: (v: string) => void;
  remindBefore?: boolean;
  remindOnDue?: boolean;
  remindOverdue?: boolean;
  onRemindBeforeChange?: (v: boolean) => void;
  onRemindOnDueChange?: (v: boolean) => void;
  onRemindOverdueChange?: (v: boolean) => void;
  tenantName?: string;
}) {
  const name = tenantName ?? "el inquilino";
  const canEdit = !!onRemindBeforeChange;

  const checkRow = (
    checked: boolean,
    onChange: ((v: boolean) => void) | undefined,
    label: React.ReactNode,
    sub: string,
    isLast?: boolean,
  ) => (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: "0.75rem",
      padding: "0.7rem 0.9rem",
      borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)",
      cursor: canEdit ? "pointer" : "default",
      opacity: checked ? 1 : 0.5,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!canEdit}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ marginTop: "2px", accentColor: "#059669", width: "16px", height: "16px", flexShrink: 0 }}
      />
      <div>
        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#1c1c1e", lineHeight: 1.3 }}>{label}</p>
        <p style={{ margin: "0.1rem 0 0", fontSize: "0.74rem", color: "#8e8e93", lineHeight: 1.4 }}>{sub}</p>
      </div>
    </label>
  );

  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      {/* 3 checkboxes */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {checkRow(
          remindBefore,
          onRemindBeforeChange,
          <span>
            Aviso previo —{" "}
            {canEdit ? (
              <input
                type="number"
                min={1}
                max={30}
                value={days}
                onClick={(e) => e.preventDefault()}
                onChange={(e) => onDaysChange(e.target.value)}
                style={{
                  width: "36px", border: "none", borderBottom: "1.5px solid #059669",
                  background: "transparent", fontSize: "0.85rem", fontWeight: 700,
                  color: "#059669", textAlign: "center", outline: "none", padding: 0,
                }}
              />
            ) : days} días antes
          </span>,
          `Le avisamos a ${name} que se acerca el vencimiento`,
        )}
        {checkRow(
          remindOnDue,
          onRemindOnDueChange,
          "Recordatorio el día del vencimiento",
          `Le recordamos a ${name} que hoy vence`,
        )}
        {checkRow(
          remindOverdue,
          onRemindOverdueChange,
          "Seguimiento si no llegó el pago — 5 días después",
          `Solo si el pago no fue confirmado, le avisamos a ${name}`,
          true,
        )}
      </div>

      {/* Channel */}
      <p style={{ margin: "0.1rem 0 0 2px", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Canal
      </p>
      <SegmentedControl
        options={[
          { value: "email",    label: "Email" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "both",     label: "Ambos" },
        ]}
        value={channel}
        onChange={canEdit ? onChannelChange : () => {}}
      />

      {channel !== "email" && (
        <p style={{ margin: 0, fontSize: "0.7rem", color: "#8e8e93", lineHeight: 1.5, paddingLeft: "2px" }}>
          WhatsApp requiere Twilio y teléfono del inquilino.
        </p>
      )}
    </div>
  );
}

function IngestionModePicker({
  value,
  onChange,
}: {
  value: "manual" | "auto_email";
  onChange: (v: "manual" | "auto_email") => void;
}) {
  return (
    <OptionList
      options={[
        { value: "manual",     label: "Manual",      sub: "Subís el archivo vos" },
        { value: "auto_email", label: "Automático",  sub: "Casita busca en tu email" },
      ]}
      value={value}
      onChange={(v) => onChange(v as "manual" | "auto_email")}
    />
  );
}

/* ── Billing period picker ───────────────────────────────────────── */
function BillingPeriodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <p style={{ margin: "0 0 0 2px", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Frecuencia
      </p>
      <SegmentedControl
        options={[
          { value: "monthly",   label: "Mensual" },
          { value: "bimonthly", label: "Bimestral" },
          { value: "quarterly", label: "Trimestral" },
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "30px",
        padding: "0.38rem 0.85rem",
        borderRadius: "0.62rem",
        border: selected ? "1.5px solid var(--c-accent)" : "1.5px solid #a7f3d0",
        background: selected ? "var(--c-accent-light)" : "#ffffff",
        color: selected ? "var(--c-accent)" : "#059669",
        fontWeight: selected ? 700 : 600,
        fontSize: "0.79rem",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: selected ? "0 1px 0 rgba(61, 107, 84, 0.12)" : "0 1px 0 rgba(61, 107, 84, 0.05)",
      }}
    >
      {label}
    </button>
  );
}

/* ── iOS Segmented Control ───────────────────────────────────────── */
function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: "flex",
      background: "rgba(118,118,128,0.12)",
      borderRadius: "9px",
      padding: "2px",
      gap: "2px",
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            height: "34px",
            border: "none",
            borderRadius: "7px",
            fontSize: "0.82rem",
            fontWeight: value === opt.value ? 600 : 400,
            background: value === opt.value ? "#ffffff" : "transparent",
            color: value === opt.value ? "#1c1c1e" : "#636366",
            cursor: "pointer",
            transition: "background 0.15s, box-shadow 0.15s",
            boxShadow: value === opt.value
              ? "0 1px 3px rgba(0,0,0,0.12), 0 0.5px 1px rgba(0,0,0,0.08)"
              : "none",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── iOS Option List (grouped list with radio circles) ───────────── */
function OptionList({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; sub?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "12px",
      overflow: "hidden",
      border: "1px solid rgba(0,0,0,0.07)",
    }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "0 14px",
            minHeight: "50px",
            background: value === opt.value ? "rgba(61,107,84,0.08)" : "transparent",
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
            {opt.sub && (
              <div style={{ fontSize: "0.73rem", color: "#8e8e93", marginTop: "1px" }}>
                {opt.sub}
              </div>
            )}
          </div>
          <div style={{
            width: "26px", height: "26px",
            borderRadius: "50%",
            border: value === opt.value ? "none" : "2px solid #c7c7cc",
            background: value === opt.value ? "#059669" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: value === opt.value ? "0 1px 4px rgba(61,107,84,0.4)" : "none",
          }}>
            {value === opt.value && (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5l3 3 5-5.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  title,
  danger,
  active,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  active?: boolean;
  accent?: boolean;
}) {
  let bg = "#f8fbfa";
  let border = "#a7f3d0";
  let color = "#2f5a46";

  if (danger) { bg = "#fef2f2"; border = "#f0bfd0"; color = "#dc2626"; }
  else if (active) { bg = "var(--c-accent)"; border = "var(--c-accent)"; color = "#fff"; }
  else if (accent) { bg = "#ecfdf5"; border = "#bfd7cb"; color = "#2f5a46"; }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.28rem",
        minWidth: "30px",
        height: "30px",
        borderRadius: "8px",
        border: `1px solid ${border}`,
        background: bg,
        color,
        cursor: "pointer",
        padding: "0 0.5rem",
        transition: "all 0.12s ease",
        fontSize: "0.72rem",
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

/* ── Subir boleta desde template ─────────────────────────────────── */
const TYPE_LABEL_SHORT: Record<string, string> = {
  expensas: "Expensas", electricity: "Luz", gas: "Gas",
  water: "Agua", internet: "Internet", custom: "Servicio",
};

type BillSheetStage =
  | { s: "idle" } | { s: "reading" }
  | { s: "extracted"; amount: string; dueDate: string; obligationId: string; billUrl: string; period: string | null; aiExtracted: boolean }
  | { s: "manual" } | { s: "saving" } | { s: "done" };

function TemplateBillButton({
  templateId, templateTitle, templateType, unitId, label,
}: {
  templateId: string; templateTitle: string; templateType: string; unitId: string; label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<BillSheetStage>({ s: "idle" });
  const [manualAmt, setManualAmt] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [overrideAmt, setOverrideAmt] = useState("");
  const [overrideDate, setOverrideDate] = useState("");

  function close() {
    setOpen(false);
    setTimeout(() => {
      setStage({ s: "idle" });
      setManualAmt(""); setManualDate("");
      setOverrideAmt(""); setOverrideDate("");
    }, 200);
  }

  async function handleFile(file: File) {
    setStage({ s: "reading" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("unitId", unitId);
    try {
      const res = await fetch(`/api/obligation-templates/${templateId}/monthly-bill`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error");
      const dueDateStr = data.dueDate ? data.dueDate.slice(0, 10) : "";
      setOverrideAmt(data.extractedAmount != null ? data.amount : "");
      setOverrideDate(dueDateStr);
      /* extractedAmount is only non-null if Gemini actually ran */
      setStage({ s: "extracted", amount: data.amount, dueDate: data.dueDate ?? "", obligationId: data.obligationId, billUrl: data.originalBillUrl, period: data.extractedPeriod ?? null, aiExtracted: data.extractedAmount != null });
    } catch {
      setStage({ s: "manual" });
    }
  }

  async function saveManual() {
    if (!manualAmt || !manualDate) return;
    setStage({ s: "saving" });
    const fd = new FormData();
    fd.append("unitId", unitId);
    fd.append("manualAmount", manualAmt);
    fd.append("manualDueDate", new Date(manualDate + "T12:00:00").toISOString());
    const res = await fetch(`/api/obligation-templates/${templateId}/monthly-bill`, { method: "POST", body: fd });
    if (res.ok) { setStage({ s: "done" }); router.refresh(); setTimeout(close, 1400); }
    else setStage({ s: "manual" });
  }

  async function confirmExtracted() {
    if (stage.s !== "extracted") return;
    setStage({ s: "saving" });
    /* When no AI, always send the manually entered amount. When AI ran, only patch if changed. */
    const amtChanged = overrideAmt && (overrideAmt !== stage.amount || !stage.aiExtracted);
    const dateChanged = overrideDate && overrideDate !== stage.dueDate.slice(0, 10);
    if (amtChanged || dateChanged) {
      await fetch(`/api/obligations/${stage.obligationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(amtChanged ? { amount: Number(overrideAmt) } : {}),
          ...(dateChanged ? { dueDate: new Date(overrideDate + "T12:00:00").toISOString() } : {}),
        }),
      });
    }
    setStage({ s: "done" });
    router.refresh();
    setTimeout(close, 1400);
  }

  const typeLabel = TYPE_LABEL_SHORT[templateType] ?? templateType;

  return (
    <>
      <button
        type="button"
        title="Subir boleta del mes"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.25rem",
          fontSize: "0.67rem", fontWeight: 600, color: "#059669",
          background: "#ecfdf5", border: "1px solid rgba(5,150,105,0.2)",
          borderRadius: "6px", padding: "0.2rem 0.55rem", cursor: "pointer",
          height: "28px",
        }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path d="M5 1v6M2 4L5 1l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {label ?? "Subir boleta"}
      </button>

      {open && (
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#f2f2f7", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.15)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem 0.5rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>
                  Boleta de {typeLabel}
                </p>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#8e8e93" }}>{templateTitle} · mes actual</p>
              </div>
              <button type="button" onClick={close} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div style={{ padding: "0.5rem 1.25rem 2rem", display: "grid", gap: "0.85rem" }}>
              {stage.s === "done" && (
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.65rem" }}>
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5 7.5-8" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <p style={{ fontWeight: 700, color: "#1c1c1e", margin: "0 0 0.2rem", letterSpacing: "-0.02em" }}>¡Listo!</p>
                  <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Boleta guardada. Tu inquilino fue notificado.</p>
                </div>
              )}

              {stage.s === "idle" && (
                <>
                  <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "1.5rem 1rem", background: "#fff", borderRadius: "14px", border: "1.5px dashed rgba(5,150,105,0.3)", cursor: "pointer", textAlign: "center" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 7l4-4 4 4" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h14" stroke="#059669" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#1c1c1e" }}>Subir boleta</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#8e8e93" }}>PDF o foto · Gemini extrae el monto solo</p>
                    </div>
                    <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.08)" }} />
                    <span style={{ fontSize: "0.72rem", color: "#aeaeb2", fontWeight: 500 }}>o</span>
                    <div style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.08)" }} />
                  </div>
                  <button type="button" onClick={() => setStage({ s: "manual" })} style={{ fontSize: "0.82rem", fontWeight: 500, color: "#636366", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", padding: "0.65rem 1rem", cursor: "pointer", textAlign: "center" }}>
                    Ingresar monto sin boleta
                  </button>
                </>
              )}

              {stage.s === "reading" && (
                <div style={{ background: "#fff", borderRadius: "14px", padding: "1.5rem", textAlign: "center" }}>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.88rem", fontWeight: 600, color: "#1c1c1e" }}>Leyendo boleta…</p>
                  <p style={{ margin: 0, fontSize: "0.76rem", color: "#8e8e93" }}>Gemini extrae el monto automáticamente</p>
                </div>
              )}

              {stage.s === "extracted" && (
                <>
                  {/* AI extracted: show big preview + optional correction */}
                  {stage.aiExtracted && (
                    <div style={{ background: "#fff", borderRadius: "14px", padding: "1rem" }}>
                      {stage.period && (
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", color: "#8e8e93" }}>
                          Período: <strong style={{ color: "#1c1c1e" }}>{stage.period}</strong>
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#059669", flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: "0.69rem", fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Extraído con IA
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.04em" }}>
                        {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(overrideAmt || stage.amount))}
                      </p>
                    </div>
                  )}

                  <div style={{ background: "#fff", borderRadius: "14px", padding: "1rem", display: "grid", gap: "0.75rem" }}>
                    {!stage.aiExtracted && (
                      <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Completá los datos de la boleta
                      </p>
                    )}
                    {stage.aiExtracted && (
                      <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Corregir si no coincide
                      </p>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.68rem", color: "#8e8e93", marginBottom: "0.3rem" }}>
                          Monto <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input
                          type="number"
                          className="field"
                          placeholder="0"
                          autoFocus={!stage.aiExtracted}
                          value={overrideAmt}
                          onChange={(e) => setOverrideAmt(e.target.value)}
                          style={{ fontSize: "0.9rem", fontWeight: 600 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.68rem", color: "#8e8e93", marginBottom: "0.3rem" }}>
                          Vencimiento <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input
                          type="date"
                          className="field"
                          value={overrideDate}
                          onChange={(e) => setOverrideDate(e.target.value)}
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                    </div>
                    {!overrideDate && (
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#b45309", background: "#fffbeb", padding: "0.4rem 0.6rem", borderRadius: "8px" }}>
                        Agregá la fecha de vencimiento para que el inquilino sepa cuándo pagar.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={confirmExtracted}
                    disabled={!overrideDate || !overrideAmt}
                    style={{
                      background: overrideDate && overrideAmt ? "#059669" : "#e5e7eb",
                      color: overrideDate && overrideAmt ? "#fff" : "#9ca3af",
                      border: "none", borderRadius: "12px", padding: "0.85rem 1rem",
                      fontSize: "0.92rem", fontWeight: 700,
                      cursor: overrideDate && overrideAmt ? "pointer" : "not-allowed",
                    }}
                  >
                    Guardar
                  </button>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#8e8e93", textAlign: "center" }}>
                    El recordatorio se manda automáticamente {`${overrideDate ? new Date(overrideDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "según el vencimiento"}`}
                  </p>
                </>
              )}

              {(stage.s === "manual" || stage.s === "saving") && (
                <>
                  <div style={{ background: "#fff", borderRadius: "14px", padding: "1rem", display: "grid", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>
                        Monto a cobrar <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input autoFocus type="number" className="field" placeholder="Ej: 42600" value={manualAmt} onChange={(e) => setManualAmt(e.target.value)} style={{ fontSize: "1.1rem", fontWeight: 600 }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>
                        Fecha de vencimiento <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input type="date" className="field" value={manualDate} onChange={(e) => setManualDate(e.target.value)} style={{ fontSize: "0.88rem" }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={saveManual}
                    disabled={!manualAmt || !manualDate || stage.s === "saving"}
                    style={{
                      background: manualAmt && manualDate ? "#059669" : "#e5e7eb",
                      color: manualAmt && manualDate ? "#fff" : "#9ca3af",
                      border: "none", borderRadius: "12px", padding: "0.85rem 1rem",
                      fontSize: "0.92rem", fontWeight: 700,
                      cursor: manualAmt && manualDate ? "pointer" : "not-allowed",
                    }}
                  >
                    {stage.s === "saving" ? "Guardando…" : "Guardar y notificar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Cobro extra (one-off) ───────────────────────────────────────── */
function ExtraChargeButton({ unitId, onSaved }: { unitId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function close() { setOpen(false); setTitle(""); setAmount(""); setDueDate(""); setErr(null); }

  async function save() {
    if (!title || !amount || !dueDate) { setErr("Completá todos los campos."); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/obligations/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, type: "custom", title, amount: Number(amount), dueDate }),
    });
    setBusy(false);
    if (res.ok) { close(); onSaved(); }
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Error al guardar"); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.73rem", fontWeight: 500, color: "#8e8e93", background: "none", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: "8px", padding: "0.45rem 0.85rem", cursor: "pointer", width: "100%", justifyContent: "center" }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        Cobro puntual
      </button>

      {open && (
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#f2f2f7", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.15)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem 0.5rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Cobro puntual</p>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#8e8e93" }}>Un cargo que no se repite — solo este mes</p>
              </div>
              <button type="button" onClick={close} style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ padding: "0.5rem 1.25rem 2rem", display: "grid", gap: "0.75rem" }}>
              {/* Hint: steer toward recurring if needed */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.6rem 0.75rem", background: "#fff9e6", border: "1px solid #f0d060", borderRadius: "10px" }}>
                <span style={{ fontSize: "0.88rem", lineHeight: 1 }}>💡</span>
                <p style={{ margin: 0, fontSize: "0.74rem", color: "#92660a", lineHeight: 1.5 }}>
                  ¿Es expensas, luz, gas o agua? Usá <strong>Agregar cobro recurrente</strong> arriba — así aparece automáticamente según la frecuencia.
                </p>
              </div>
              <div style={{ background: "#fff", borderRadius: "14px", padding: "1rem", display: "grid", gap: "0.7rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Descripción</label>
                  <input autoFocus className="field" placeholder="Ej: Reparación de caño" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: "0.9rem" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Monto</label>
                    <input type="number" className="field" placeholder="Ej: 15000" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ fontSize: "0.9rem" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>Vencimiento</label>
                    <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ fontSize: "0.85rem" }} />
                  </div>
                </div>
              </div>
              {err && <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626" }}>{err}</p>}
              <button type="button" onClick={save} disabled={busy} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: "12px", padding: "0.85rem 1rem", fontSize: "0.92rem", fontWeight: 700, cursor: "pointer" }}>
                {busy ? "Guardando…" : "Guardar cobro extra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Shown when auto_email is selected but no email is connected yet */
function EmailConnectHint() {
  return (
    <div style={{
      background: "#fffbeb",
      border: "1.5px solid #fcd34d",
      borderRadius: "10px",
      padding: "0.75rem 1rem",
      fontSize: "0.8rem",
      color: "#92400e",
      lineHeight: 1.5,
    }}>
      <strong>Email no conectado.</strong>{" "}
      Para buscar facturas automáticamente necesitás conectar tu email en{" "}
      <a href="/dashboard/settings" style={{ color: "#059669", fontWeight: 600, textDecoration: "underline" }}>
        Ajustes de cuenta
      </a>
      {" "}— se configura una sola vez para todas tus casitas.
    </div>
  );
}
