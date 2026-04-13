export type WorkspaceSummary = {
  id: string;
  name: string;
  tenant: string | null;
};

export type AdvisorIntent =
  | "delete_casita"
  | "end_rental"
  | "ambiguous_multi_workspace"
  | "tenant_save_claim"
  | "tenant_save_proof";

export type AdvisorInput = {
  intent: AdvisorIntent;
  ownerMessage: string;
  workspaces: WorkspaceSummary[];
  operationalContext: {
    targetWorkspaceId?: string;
    pendingObligationsCount?: number;
    activeRemindersCount?: number;
    tenantName?: string | null;
    hasProofPending?: boolean;
  };
};

export type AdvisorOutput = {
  plan: string;
  risks: string[];
  recommendation: string;
  stop: boolean;
  stopReason?: string | null;
  confidence: number;
  _fallback?: boolean;
};
