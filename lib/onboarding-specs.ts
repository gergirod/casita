/**
 * Onboarding field specifications — single source of truth.
 *
 * Used by:
 *  - get_field_requirements tool  → bot knows what to collect before calling a create action
 *  - service validators           → deterministic enforcement (bot can't skip required fields)
 */

export type FieldSpec = {
  key: string;
  label: string;           // Human-readable, shown to owner
  required: boolean;
  type: "string" | "number" | "integer" | "enum" | "boolean";
  options?: string[];      // For enum fields
  dependsOn?: { field: string; value: string };  // Conditional on another field value
  hint?: string;           // Extra context for the bot or owner
};

export type ActionSpec = {
  action: string;
  description: string;
  fields: FieldSpec[];
};

// ─── Specs ────────────────────────────────────────────────────────

export const ONBOARDING_SPECS: Record<string, ActionSpec> = {

  create_casita: {
    action: "create_casita",
    description: "Crear una casita nueva con método de pago, inquilino y alquiler",
    fields: [
      { key: "name",                 label: "Nombre de la casita",                        required: true,  type: "string" },
      { key: "payment_method",       label: "Método de cobro (transferencia o Mercado Pago)", required: true,  type: "enum", options: ["cbu", "mp_link"] },
      { key: "payment_cbu",          label: "CBU o alias",                                required: true,  type: "string", hint: "El alias o CBU a donde paga el inquilino" },
      { key: "payment_holder_name",  label: "Nombre del titular de la cuenta",            required: false, type: "string", dependsOn: { field: "payment_method", value: "cbu" } },
      { key: "tenant_name",          label: "Nombre del inquilino",                       required: false, type: "string" },
      { key: "tenant_whatsapp",      label: "WhatsApp del inquilino",                     required: false, type: "string", hint: "Incluir código de país ej: +549..." },
      { key: "tenant_email",         label: "Email del inquilino",                        required: false, type: "string" },
      { key: "rent_amount",          label: "Monto del alquiler",                         required: false, type: "number", hint: "Requerido si hay inquilino" },
      { key: "rent_currency",        label: "Moneda del alquiler",                        required: false, type: "enum", options: ["ARS", "USD"] },
      { key: "due_day",              label: "Día de vencimiento (1-31)",                  required: false, type: "integer", hint: "Requerido si hay monto de alquiler" },
    ],
  },

  create_recurring_charge: {
    action: "create_recurring_charge",
    description: "Crear un cobro recurrente (expensas, servicios, etc.)",
    fields: [
      { key: "title",      label: "Nombre del cobro (ej: Expensas, Luz EDESUR)", required: true,  type: "string" },
      { key: "frequency",  label: "Frecuencia",                                   required: true,  type: "enum", options: ["monthly", "bimonthly", "quarterly"] },
      { key: "amount",     label: "Monto (0 si varía cada período)",              required: true,  type: "number", hint: "Si varía mes a mes poner 0 y recordarle que suba la factura" },
      { key: "due_day",    label: "Día de vencimiento (1-31)",                    required: true,  type: "integer" },
      { key: "currency",   label: "Moneda",                                        required: false, type: "enum", options: ["ARS", "USD"] },
    ],
  },

  create_manual_charge: {
    action: "create_manual_charge",
    description: "Crear un cobro puntual de una sola vez",
    fields: [
      { key: "title",       label: "Descripción del cobro",    required: true,  type: "string" },
      { key: "amount",      label: "Monto",                    required: true,  type: "number" },
      { key: "due_date",    label: "Fecha de vencimiento",     required: true,  type: "string", hint: "Formato DD/MM/YYYY" },
      { key: "currency",    label: "Moneda",                   required: false, type: "enum", options: ["ARS", "USD"] },
    ],
  },

  create_new_rental: {
    action: "create_new_rental",
    description: "Dar de alta un nuevo inquilino en una casita existente",
    fields: [
      { key: "tenant_name",      label: "Nombre del inquilino",           required: true,  type: "string" },
      { key: "tenant_whatsapp",  label: "WhatsApp del inquilino",         required: true,  type: "string", hint: "Incluir código de país ej: +549..." },
      { key: "tenant_email",     label: "Email del inquilino",            required: false, type: "string" },
      { key: "lease_end_date",   label: "Fecha de fin de contrato",       required: false, type: "string" },
    ],
  },

};

// ─── Validator ────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true }
  | { ok: false; missing: string[]; message: string };

/**
 * Validates that all required fields for an action are present.
 * Returns a list of missing field labels so the bot can ask for them.
 */
export function validateRequiredFields(
  action: string,
  data: Record<string, unknown>,
): ValidationResult {
  const spec = ONBOARDING_SPECS[action];
  if (!spec) return { ok: true }; // Unknown action — no validation

  const missing: string[] = [];

  for (const field of spec.fields) {
    if (!field.required) continue;

    // Skip conditional fields if condition is not met
    if (field.dependsOn) {
      const parentValue = data[field.dependsOn.field];
      if (parentValue !== field.dependsOn.value) continue;
    }

    const value = data[field.key];
    if (value === undefined || value === null || value === "") {
      missing.push(field.label);
    }
  }

  if (missing.length === 0) return { ok: true };

  return {
    ok: false,
    missing,
    message: `Faltan datos para ${spec.description}: ${missing.join(", ")}.`,
  };
}

/**
 * Returns the spec for a given action formatted for the bot to explain to the owner.
 */
export function getFieldRequirements(action: string): string {
  const spec = ONBOARDING_SPECS[action];
  if (!spec) return JSON.stringify({ error: `Acción desconocida: ${action}` });

  const required = spec.fields.filter(f => f.required).map(f => ({
    field: f.key,
    label: f.label,
    type: f.type,
    ...(f.options ? { options: f.options } : {}),
    ...(f.hint ? { hint: f.hint } : {}),
  }));

  const optional = spec.fields.filter(f => !f.required).map(f => ({
    field: f.key,
    label: f.label,
    type: f.type,
    ...(f.dependsOn ? { dependsOn: f.dependsOn } : {}),
    ...(f.hint ? { hint: f.hint } : {}),
  }));

  return JSON.stringify({ action, description: spec.description, required, optional });
}
