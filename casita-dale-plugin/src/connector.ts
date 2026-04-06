import type {
  DaleConnectorAdapter,
  ConnectorCapability,
  ConnectorCallRequest,
  ConnectorCallResponse,
} from "./types";

/**
 * CasitaConnector — Dale connector adapter for the Casita rental operations API.
 *
 * The credential stored in Dale's vault must be a JSON string:
 *   { "token": "<casita-machine-jwt>", "url": "https://your-casita.app" }
 *
 * Generate the token from your Casita dashboard:
 *   POST /api/v1/token  (requires active Supabase session)
 */
export class CasitaConnector implements DaleConnectorAdapter {
  readonly capability: ConnectorCapability = {
    connectorId: "casita-api",
    supportedActions: [
      "get_overview",
      "get_obligations",
      "verify_payment",
      "send_reminder",
      "create_casita",
      "register_tenant",
    ],
    requiresApproval: false,
  };

  async execute(request: ConnectorCallRequest): Promise<ConnectorCallResponse> {
    // ── Resolve credential ────────────────────────────────────────
    if (!request.resolvedCredential) {
      return {
        success: false,
        errorCode: "missing_credential",
        errorMessage: "Casita credential not configured. Generate a token at /api/v1/token.",
      };
    }

    let token: string;
    let baseUrl: string;

    try {
      const raw = new TextDecoder().decode(request.resolvedCredential);
      const cred = JSON.parse(raw) as { token?: string; url?: string };
      if (!cred.token || !cred.url) throw new Error("malformed");
      token = cred.token;
      baseUrl = cred.url.replace(/\/$/, "");
    } catch {
      return {
        success: false,
        errorCode: "invalid_credential",
        errorMessage: 'Credential must be JSON: {"token":"...","url":"https://..."}',
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    try {
      switch (request.action) {

        // ── READ actions (no HITL) ──────────────────────────────

        case "get_overview": {
          const res = await fetch(`${baseUrl}/api/v1/overview`, { headers });
          if (!res.ok) return err("api_error", res.status);
          const body = await res.json() as { workspaces: unknown[] };
          return { success: true, data: { workspaces: body.workspaces, total: body.workspaces.length } };
        }

        case "get_obligations": {
          const { workspace_id, filter } = request.params as { workspace_id?: string; filter?: string };
          const qs = new URLSearchParams();
          if (workspace_id) qs.set("workspaceId", workspace_id);
          if (filter) qs.set("filter", filter);
          const res = await fetch(`${baseUrl}/api/v1/obligations?${qs.toString()}`, { headers });
          if (!res.ok) return err("api_error", res.status);
          const body = await res.json() as { obligations: unknown[] };
          return { success: true, data: { obligations: body.obligations, total: body.obligations.length } };
        }

        // ── WRITE actions (HITL required in pack) ───────────────

        case "verify_payment": {
          const { obligation_id } = request.params as { obligation_id: string };
          if (!obligation_id) {
            return { success: false, errorCode: "missing_param", errorMessage: "obligation_id is required" };
          }
          const res = await fetch(`${baseUrl}/api/v1/obligations/${obligation_id}/verify`, {
            method: "POST",
            headers,
          });
          if (!res.ok) return err("verify_failed", res.status);
          const body = await res.json() as { obligationId: string; title: string };
          return {
            success: true,
            data: { obligationId: body.obligationId, title: body.title },
            externalRef: body.obligationId,
          };
        }

        case "send_reminder": {
          const { obligation_id } = request.params as { obligation_id: string };
          if (!obligation_id) {
            return { success: false, errorCode: "missing_param", errorMessage: "obligation_id is required" };
          }
          const res = await fetch(`${baseUrl}/api/v1/reminders`, {
            method: "POST",
            headers,
            body: JSON.stringify({ obligationId: obligation_id }),
          });
          if (!res.ok) return err("reminder_failed", res.status);
          const body = await res.json() as { channels: string[] };
          return { success: true, data: { channels: body.channels }, externalRef: obligation_id };
        }

        case "create_casita": {
          const res = await fetch(`${baseUrl}/api/v1/workspaces`, {
            method: "POST",
            headers,
            body: JSON.stringify(request.params),
          });
          if (!res.ok) return err("create_failed", res.status);
          const body = await res.json() as { workspaceId: string; unitId: string };
          return {
            success: true,
            data: { workspaceId: body.workspaceId, unitId: body.unitId },
            externalRef: body.workspaceId,
          };
        }

        case "register_tenant": {
          const res = await fetch(`${baseUrl}/api/v1/tenants`, {
            method: "POST",
            headers,
            body: JSON.stringify(request.params),
          });
          if (!res.ok) return err("register_failed", res.status);
          const body = await res.json() as { unitId: string };
          return {
            success: true,
            data: { unitId: body.unitId },
            externalRef: body.unitId,
          };
        }

        default:
          return {
            success: false,
            errorCode: "action_not_supported",
            errorMessage: `Action not supported: ${request.action}`,
          };
      }
    } catch (e) {
      return {
        success: false,
        errorCode: "network_error",
        errorMessage: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }
}

function err(code: string, status: number): ConnectorCallResponse {
  return { success: false, errorCode: code, errorMessage: `HTTP ${status}` };
}
