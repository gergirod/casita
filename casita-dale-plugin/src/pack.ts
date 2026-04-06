import type { DalePackManifest, Graph } from "./types";

// ── Graph 1: Resumen de casitas (read-only, no HITL) ─────────────

const overviewGraph: Graph = {
  id: "casita/overview-v1",
  version: "1.0",
  nodes: [
    { id: "start", type: "start", policy: "auto" },
    {
      id: "get_overview",
      type: "action",
      policy: "auto",
      label: "Obtener resumen de casitas",
      connectorId: "casita-api",
      connectorAction: "get_overview",
      connectorParams: {},
    },
    { id: "end", type: "end", policy: "auto" },
  ],
  edges: [
    { from: "start", to: "get_overview" },
    { from: "get_overview", to: "end" },
  ],
};

// ── Graph 2: Ver obligaciones de una casita (read-only, no HITL) ─

const obligationsGraph: Graph = {
  id: "casita/obligations-v1",
  version: "1.0",
  nodes: [
    { id: "start", type: "start", policy: "auto" },
    {
      id: "get_obligations",
      type: "action",
      policy: "auto",
      label: "Listar cobros y obligaciones",
      connectorId: "casita-api",
      connectorAction: "get_obligations",
      connectorParams: {},
    },
    { id: "end", type: "end", policy: "auto" },
  ],
  edges: [
    { from: "start", to: "get_obligations" },
    { from: "get_obligations", to: "end" },
  ],
};

// ── Graph 3: Verificar pago (HITL antes del write) ───────────────

const verifyPaymentGraph: Graph = {
  id: "casita/verify-payment-v1",
  version: "1.0",
  nodes: [
    { id: "start", type: "start", policy: "auto" },
    {
      id: "get_obligations",
      type: "action",
      policy: "auto",
      label: "Ver cobros pendientes de verificación",
      connectorId: "casita-api",
      connectorAction: "get_obligations",
      connectorParams: { filter: "proof_uploaded" },
    },
    {
      // Dale pauses here and asks: "¿Confirmás la verificación del pago?"
      id: "confirm_verify",
      type: "action",
      policy: "confirm",
      label: "Confirmar verificación de pago",
    },
    {
      id: "verify_payment",
      type: "action",
      policy: "auto",
      label: "Marcar pago como verificado en Casita",
      connectorId: "casita-api",
      connectorAction: "verify_payment",
      connectorParams: {},
    },
    { id: "end", type: "end", policy: "auto" },
  ],
  edges: [
    { from: "start", to: "get_obligations" },
    { from: "get_obligations", to: "confirm_verify" },
    { from: "confirm_verify", to: "verify_payment" },
    { from: "verify_payment", to: "end" },
  ],
};

// ── Graph 4: Mandar recordatorio (HITL antes del envío) ──────────

const sendReminderGraph: Graph = {
  id: "casita/send-reminder-v1",
  version: "1.0",
  nodes: [
    { id: "start", type: "start", policy: "auto" },
    {
      id: "get_obligations",
      type: "action",
      policy: "auto",
      label: "Ver cobros pendientes",
      connectorId: "casita-api",
      connectorAction: "get_obligations",
      connectorParams: { filter: "pending" },
    },
    {
      id: "confirm_reminder",
      type: "action",
      policy: "confirm",
      label: "Confirmar envío de recordatorio al inquilino",
    },
    {
      id: "send_reminder",
      type: "action",
      policy: "auto",
      label: "Enviar recordatorio de pago",
      connectorId: "casita-api",
      connectorAction: "send_reminder",
      connectorParams: {},
    },
    { id: "end", type: "end", policy: "auto" },
  ],
  edges: [
    { from: "start", to: "get_obligations" },
    { from: "get_obligations", to: "confirm_reminder" },
    { from: "confirm_reminder", to: "send_reminder" },
    { from: "send_reminder", to: "end" },
  ],
};

// ── Graph 5: Crear casita nueva (HITL antes del write) ───────────

const createCasitaGraph: Graph = {
  id: "casita/create-casita-v1",
  version: "1.0",
  nodes: [
    { id: "start", type: "start", policy: "auto" },
    {
      id: "confirm_create",
      type: "action",
      policy: "confirm",
      label: "Confirmar creación de nueva casita",
    },
    {
      id: "create_casita",
      type: "action",
      policy: "auto",
      label: "Crear casita en Casita",
      connectorId: "casita-api",
      connectorAction: "create_casita",
      connectorParams: {},
    },
    { id: "end", type: "end", policy: "auto" },
  ],
  edges: [
    { from: "start", to: "confirm_create" },
    { from: "confirm_create", to: "create_casita" },
    { from: "create_casita", to: "end" },
  ],
};

// ── Pack manifest ────────────────────────────────────────────────

export const casitaPack: DalePackManifest = {
  id: "casita-rentals",
  name: "Casita Rentals Pack",
  version: "1.0.0",
  intents: [
    {
      id: "casita_overview",
      keywords: [
        "mis casitas",
        "resumen casita",
        "resumen alquileres casita",
        "estado propiedades casita",
        "ver propiedades casita",
      ],
      graphId: "casita/overview-v1",
    },
    {
      id: "casita_obligations",
      keywords: [
        "cobros pendientes casita",
        "ver obligaciones casita",
        "que cobros tengo casita",
        "facturas pendientes casita",
        "vencimientos casita",
      ],
      graphId: "casita/obligations-v1",
    },
    {
      id: "casita_verify_payment",
      keywords: [
        "verificar pago casita",
        "confirmar pago inquilino casita",
        "marcar pago casita",
        "pago recibido casita",
        "aprobar comprobante casita",
      ],
      graphId: "casita/verify-payment-v1",
    },
    {
      id: "casita_send_reminder",
      keywords: [
        "mandar recordatorio casita",
        "recordar pago casita",
        "avisar al inquilino casita",
        "enviar aviso de pago casita",
        "recordatorio alquiler casita",
      ],
      graphId: "casita/send-reminder-v1",
    },
    {
      id: "casita_create",
      keywords: [
        "nueva casita",
        "crear casita",
        "agregar propiedad casita",
        "alta propiedad casita",
        "registrar casita nueva",
      ],
      graphId: "casita/create-casita-v1",
    },
  ],
  graphs: [
    overviewGraph,
    obligationsGraph,
    verifyPaymentGraph,
    sendReminderGraph,
    createCasitaGraph,
  ],
};
