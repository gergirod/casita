/*
  Catálogo de proveedores de servicios conocidos en Argentina.
  ─────────────────────────────────────────────────────────────
  senderPatterns: strings que aparecen en el FROM del email de la factura.
  Se usan para armar los filtros de n8n automáticamente.
*/

export type ServiceType = "electricity" | "gas" | "water" | "internet" | "expensas";

export type BillingPeriod = "monthly" | "bimonthly" | "quarterly";

export type Provider = {
  slug: string;
  name: string;
  type: ServiceType;
  region?: string;              /* "GBA" | "CABA" | "Córdoba" | "Nacional" | etc. */
  senderPatterns: string[];     /* emails o dominios conocidos del proveedor */
  billingPeriod: BillingPeriod; /* frecuencia de facturación típica */
  website?: string;
};

export const PROVIDERS: Provider[] = [
  /* ── Electricidad ─────────────────────────────────────────── */
  {
    slug:           "edenor",
    name:           "Edenor",
    type:           "electricity",
    region:         "GBA Norte / CABA Norte",
    billingPeriod:  "bimonthly",          /* Edenor factura cada 2 meses */
    senderPatterns: ["@edenor.com", "factura@edenor.com", "noreply@edenor.com"],
    website:        "https://www.edenor.com",
  },
  {
    slug:           "edesur",
    name:           "Edesur",
    type:           "electricity",
    region:         "GBA Sur / CABA Sur",
    billingPeriod:  "bimonthly",          /* Edesur factura cada 2 meses */
    senderPatterns: ["@edesur.com.ar", "facturacion@edesur.com.ar"],
    website:        "https://www.edesur.com.ar",
  },
  {
    slug:           "epec",
    name:           "EPEC",
    type:           "electricity",
    region:         "Córdoba",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@epec.com.ar", "facturacion@epec.com.ar"],
    website:        "https://www.epec.com.ar",
  },
  {
    slug:           "epen",
    name:           "EPEN",
    type:           "electricity",
    region:         "Neuquén",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@epen.com.ar"],
    website:        "https://www.epen.com.ar",
  },
  {
    slug:           "edea",
    name:           "EDEA",
    type:           "electricity",
    region:         "Mar del Plata",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@edea.com.ar"],
    website:        "https://www.edea.com.ar",
  },
  {
    slug:           "edersa",
    name:           "EDERSA",
    type:           "electricity",
    region:         "Río Negro",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@edersa.com.ar"],
    website:        "https://www.edersa.com.ar",
  },

  /* ── Gas ──────────────────────────────────────────────────── */
  {
    slug:           "metrogas",
    name:           "Metrogas",
    type:           "gas",
    region:         "CABA / GBA",
    billingPeriod:  "bimonthly",          /* Metrogas factura cada 2 meses */
    senderPatterns: ["@metrogas.com.ar", "facturacion@metrogas.com.ar", "noreply@metrogas.com.ar"],
    website:        "https://www.metrogas.com.ar",
  },
  {
    slug:           "camuzzi-pampeana",
    name:           "Camuzzi Gas Pampeana",
    type:           "gas",
    region:         "GBA Sur / La Pampa / Patagonia",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@camuzzigaspampeana.com.ar", "factura@camuzzigaspampeana.com.ar"],
    website:        "https://www.camuzzigaspampeana.com.ar",
  },
  {
    slug:           "camuzzi-sur",
    name:           "Camuzzi Gas del Sur",
    type:           "gas",
    region:         "Patagonia",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@camuzzigasdelsur.com.ar"],
    website:        "https://www.camuzzigasdelsur.com.ar",
  },
  {
    slug:           "naturgy",
    name:           "Naturgy (ex Gas Natural Fenosa)",
    type:           "gas",
    region:         "Córdoba / Centro",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@naturgy.com", "noreply@naturgy.com.ar"],
    website:        "https://www.naturgy.com.ar",
  },
  {
    slug:           "litoral-gas",
    name:           "Litoral Gas",
    type:           "gas",
    region:         "Santa Fe / Chaco",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@litoralgas.com.ar"],
    website:        "https://www.litoralgas.com.ar",
  },

  /* ── Agua ─────────────────────────────────────────────────── */
  {
    slug:           "aysa",
    name:           "AySA",
    type:           "water",
    region:         "CABA / GBA",
    billingPeriod:  "bimonthly",          /* AySA factura cada 2 meses */
    senderPatterns: ["@aysa.com.ar", "facturacion@aysa.com.ar", "noreply@aysa.com.ar"],
    website:        "https://www.aysa.com.ar",
  },
  {
    slug:           "absa",
    name:           "ABSA",
    type:           "water",
    region:         "GBA",
    billingPeriod:  "bimonthly",
    senderPatterns: ["@aguasbonaerenses.com.ar", "facturacion@aguasbonaerenses.com.ar"],
    website:        "https://www.aguasbonaerenses.com.ar",
  },
  {
    slug:           "aguas-cordobesas",
    name:           "Aguas Cordobesas",
    type:           "water",
    region:         "Córdoba",
    billingPeriod:  "monthly",
    senderPatterns: ["@aguascordobesas.com.ar"],
    website:        "https://www.aguascordobesas.com.ar",
  },

  /* ── Internet / Telefonía ─────────────────────────────────── */
  {
    slug:           "telecentro",
    name:           "Telecentro",
    type:           "internet",
    region:         "CABA / GBA",
    billingPeriod:  "monthly",
    senderPatterns: ["@telecentro.com.ar", "facturacion@telecentro.com.ar", "noreply@telecentro.com.ar"],
    website:        "https://www.telecentro.com.ar",
  },
  {
    slug:           "fibertel",
    name:           "Fibertel / Claro",
    type:           "internet",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@fibertel.com.ar", "@claro.com.ar", "facturacion@claro.com.ar"],
    website:        "https://www.claro.com.ar",
  },
  {
    slug:           "personal",
    name:           "Personal / Flow",
    type:           "internet",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@personal.com.ar", "@flow.com.ar", "noreply@personal.com.ar"],
    website:        "https://www.personal.com.ar",
  },
  {
    slug:           "movistar",
    name:           "Movistar",
    type:           "internet",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@movistar.com.ar", "factura@movistar.com.ar"],
    website:        "https://www.movistar.com.ar",
  },
  {
    slug:           "directv",
    name:           "DirecTV",
    type:           "internet",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@directv.com", "facturacion@directv.com.ar"],
    website:        "https://www.directv.com.ar",
  },
  {
    slug:           "speedy",
    name:           "Speedy / Telefónica",
    type:           "internet",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@speedy.com.ar", "@telefonica.com.ar"],
    website:        "https://www.telefonica.com.ar",
  },

  /* ── Expensas ─────────────────────────────────────────────── */
  {
    slug:           "expensas-claras",
    name:           "Expensas Claras",
    type:           "expensas",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@expensasclaras.com.ar", "noreply@expensasclaras.com.ar"],
    website:        "https://www.expensasclaras.com.ar",
  },
  {
    slug:           "properati",
    name:           "Properati Expensas",
    type:           "expensas",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@properati.com"],
    website:        "https://www.properati.com.ar",
  },
  {
    slug:           "consorcio-abierto",
    name:           "Consorcio Abierto",
    type:           "expensas",
    region:         "Nacional",
    billingPeriod:  "monthly",
    senderPatterns: ["@consorcioabierto.com.ar"],
    website:        "https://www.consorcioabierto.com.ar",
  },
  {
    slug:           "administracion-propia",
    name:           "Administración propia",
    type:           "expensas",
    region:         "—",
    billingPeriod:  "monthly",
    senderPatterns: [],   /* email manual, no hay patrón fijo */
  },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

export function getProvidersByType(type: ServiceType): Provider[] {
  return PROVIDERS.filter((p) => p.type === type);
}

export function getProvider(slug: string): Provider | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}

/** Devuelve todos los senderPatterns activos para un workspace dado sus templates */
export function getActiveSenderPatterns(
  providerSlugs: (string | null)[]
): { provider: Provider; patterns: string[] }[] {
  const result: { provider: Provider; patterns: string[] }[] = [];
  const seen = new Set<string>();

  for (const slug of providerSlugs) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const p = getProvider(slug);
    if (p && p.senderPatterns.length > 0) {
      result.push({ provider: p, patterns: p.senderPatterns });
    }
  }

  return result;
}

/** Cuántos días mínimo entre facturas según período de facturación */
export const BILLING_PERIOD_DAYS: Record<BillingPeriod, number> = {
  monthly:    28,
  bimonthly:  55,
  quarterly:  85,
};

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly:   "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
};

export const TYPE_LABEL: Record<ServiceType, string> = {
  electricity: "Luz",
  gas:         "Gas",
  water:       "Agua",
  internet:    "Internet",
  expensas:    "Expensas",
};
