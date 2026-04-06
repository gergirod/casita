/**
 * Local copy of @dale/core-types contract.
 * Replace with: import type { ... } from '@dale/core-types'
 * once the package is available in your registry.
 */

export interface ConnectorCapability {
  readonly connectorId: string;
  readonly supportedActions: string[];
  readonly requiresApproval: boolean;
}

export interface ConnectorCallRequest {
  readonly connectorId: string;
  readonly action: string;
  readonly params: Record<string, unknown>;
  readonly resolvedCredential?: Uint8Array;
  readonly idempotencyKey: string;
  readonly caseId: string;
  readonly callId: string;
}

export interface ConnectorCallResponse {
  readonly success: boolean;
  readonly data?: Record<string, unknown>;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly externalRef?: string;
}

export interface DaleConnectorAdapter {
  readonly capability: ConnectorCapability;
  execute(request: ConnectorCallRequest): Promise<ConnectorCallResponse>;
}

export interface GraphNode {
  id: string;
  type: "start" | "end" | "action";
  policy: "auto" | "confirm";
  label?: string;
  connectorId?: string;
  connectorAction?: string;
  connectorParams?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Graph {
  id: string;
  version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PackIntent {
  id: string;
  keywords: string[];
  graphId: string;
}

export interface DalePackManifest {
  id: string;
  name: string;
  version: string;
  intents: PackIntent[];
  graphs: Graph[];
}

export interface DalePluginContext {
  connectors: { register(adapter: DaleConnectorAdapter): void };
  packs: { register(manifest: DalePackManifest): void };
}

export interface DalePluginManifest {
  pluginId: string;
  name: string;
  version: string;
  connectors: string[];
  packs: string[];
  apiBaseUrl?: string;
  docsUrl?: string;
}

export type DalePluginInstaller = (ctx: DalePluginContext) => DalePluginManifest;
