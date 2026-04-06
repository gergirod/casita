/**
 * CasitaConnector tests — pure unit tests, no network, no DB.
 * Run with: npx tsx tests/connector.test.ts
 */

import { CasitaConnector } from "../src/connector";
import type { ConnectorCallRequest } from "../src/types";

// ── Minimal test harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ── Mock fetch ───────────────────────────────────────────────────

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;
let currentFetch: FetchMock | null = null;

globalThis.fetch = ((url: string, init?: RequestInit) => {
  if (!currentFetch) throw new Error("fetch called but no mock set");
  return currentFetch(url, init);
}) as typeof fetch;

function mockFetch(response: { ok: boolean; status?: number; body?: unknown }): void {
  currentFetch = async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body ?? {},
  } as Response);
}

function captureFetch(): { calls: Array<[string, RequestInit | undefined]> } {
  const calls: Array<[string, RequestInit | undefined]> = [];
  currentFetch = async (url, init) => {
    calls.push([url, init]);
    return { ok: true, status: 200, json: async () => ({ workspaces: [], obligations: [], channels: [], obligationId: "ob1", wasAlreadyVerified: false, workspaceId: "ws1", unitId: "u1" }) } as Response;
  };
  return { calls };
}

function makeCredential(token = "test-token", url = "https://casita.test"): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ token, url }));
}

function req(action: string, params: Record<string, unknown> = {}, withCred = true): ConnectorCallRequest {
  return {
    connectorId: "casita-api",
    action,
    params,
    resolvedCredential: withCred ? makeCredential() : undefined,
    idempotencyKey: `test-${action}`,
    caseId: "case-1",
    callId: "call-1",
  };
}

// ── Tests ────────────────────────────────────────────────────────

async function main() {
const connector = new CasitaConnector();

console.log("\nCasitaConnector\n");

console.log("capability:");

await test("declares connectorId = casita-api", async () => {
  assert(connector.capability.connectorId === "casita-api", `got ${connector.capability.connectorId}`);
});

await test("declares all 6 supported actions", async () => {
  const actions = connector.capability.supportedActions;
  for (const a of ["get_overview", "get_obligations", "verify_payment", "send_reminder", "create_casita", "register_tenant"]) {
    assert(actions.includes(a), `missing action: ${a}`);
  }
  assert(actions.length === 6, `expected 6, got ${actions.length}`);
});

console.log("\ncredential handling:");

await test("returns missing_credential when no credential provided", async () => {
  const result = await connector.execute(req("get_overview", {}, false));
  assert(!result.success, "should fail");
  assert(result.errorCode === "missing_credential", `got ${result.errorCode}`);
});

await test("returns invalid_credential when credential is malformed JSON", async () => {
  const r = req("get_overview");
  const badCred = { ...r, resolvedCredential: new TextEncoder().encode("not-json") };
  const result = await connector.execute(badCred);
  assert(!result.success, "should fail");
  assert(result.errorCode === "invalid_credential", `got ${result.errorCode}`);
});

await test("returns invalid_credential when JSON is missing token or url", async () => {
  const r = req("get_overview");
  const badCred = { ...r, resolvedCredential: new TextEncoder().encode(JSON.stringify({ token: "x" })) };
  const result = await connector.execute(badCred);
  assert(!result.success, "should fail");
  assert(result.errorCode === "invalid_credential", `got ${result.errorCode}`);
});

console.log("\nget_overview:");

await test("returns workspaces on success", async () => {
  mockFetch({ ok: true, body: { workspaces: [{ id: "1" }, { id: "2" }] } });
  const result = await connector.execute(req("get_overview"));
  assert(result.success, "should succeed");
  assert(Array.isArray((result.data as { workspaces: unknown[] }).workspaces), "workspaces should be array");
  assert((result.data as { total: number }).total === 2, "total should be 2");
});

await test("returns api_error on HTTP failure", async () => {
  mockFetch({ ok: false, status: 503 });
  const result = await connector.execute(req("get_overview"));
  assert(!result.success, "should fail");
  assert(result.errorCode === "api_error", `got ${result.errorCode}`);
});

console.log("\nget_obligations:");

await test("returns obligations on success", async () => {
  mockFetch({ ok: true, body: { obligations: [{ id: "ob1" }] } });
  const result = await connector.execute(req("get_obligations", { filter: "pending" }));
  assert(result.success, "should succeed");
  assert((result.data as { total: number }).total === 1, "total should be 1");
});

await test("passes workspaceId and filter as query params", async () => {
  const capture = captureFetch();
  await connector.execute(req("get_obligations", { workspace_id: "ws123", filter: "overdue" }));
  const [url] = capture.calls[0];
  assert(url.includes("workspaceId=ws123"), "should include workspaceId");
  assert(url.includes("filter=overdue"), "should include filter");
});

console.log("\nverify_payment:");

await test("returns obligationId and externalRef on success", async () => {
  mockFetch({ ok: true, body: { obligationId: "ob-123", wasAlreadyVerified: false } });
  const result = await connector.execute(req("verify_payment", { obligation_id: "ob-123" }));
  assert(result.success, "should succeed");
  assert(result.externalRef === "ob-123", `externalRef should be ob-123, got ${result.externalRef}`);
});

await test("returns missing_param when obligation_id not provided", async () => {
  const result = await connector.execute(req("verify_payment", {}));
  assert(!result.success, "should fail");
  assert(result.errorCode === "missing_param", `got ${result.errorCode}`);
});

console.log("\nsend_reminder:");

await test("returns channels on success", async () => {
  mockFetch({ ok: true, body: { channels: ["email", "whatsapp"] } });
  const result = await connector.execute(req("send_reminder", { obligation_id: "ob-1" }));
  assert(result.success, "should succeed");
  assert(Array.isArray((result.data as { channels: string[] }).channels), "channels should be array");
});

console.log("\ncreate_casita:");

await test("returns workspaceId and externalRef on success", async () => {
  mockFetch({ ok: true, body: { workspaceId: "ws-new", unitId: "u-new" } });
  const result = await connector.execute(req("create_casita", { name: "Palermo 1A" }));
  assert(result.success, "should succeed");
  assert(result.externalRef === "ws-new", `externalRef should be ws-new, got ${result.externalRef}`);
});

console.log("\nregister_tenant:");

await test("returns unitId and externalRef on success", async () => {
  mockFetch({ ok: true, body: { unitId: "u-456" } });
  const result = await connector.execute(req("register_tenant", { workspaceId: "ws-1", tenantName: "Florencia" }));
  assert(result.success, "should succeed");
  assert(result.externalRef === "u-456", `externalRef should be u-456, got ${result.externalRef}`);
});

console.log("\nauth header:");

await test("includes Authorization: Bearer <token> in requests", async () => {
  const capture = captureFetch();
  await connector.execute(req("get_overview"));
  const [, init] = capture.calls[0];
  const authHeader = (init?.headers as Record<string, string>)["Authorization"];
  assert(authHeader === "Bearer test-token", `got ${authHeader}`);
});

console.log("\nsecurity:");

await test("does not include token in errorMessage on API failure", async () => {
  mockFetch({ ok: false, status: 401 });
  const result = await connector.execute(req("get_overview"));
  assert(!result.success, "should fail");
  assert(!(result.errorMessage ?? "").includes("test-token"), "token must not appear in errorMessage");
});

console.log("\nerror handling:");

await test("handles network exception and returns network_error", async () => {
  currentFetch = async () => { throw new Error("ECONNREFUSED"); };
  const result = await connector.execute(req("get_overview"));
  assert(!result.success, "should fail");
  assert(result.errorCode === "network_error", `got ${result.errorCode}`);
});

await test("returns action_not_supported for unknown action", async () => {
  const result = await connector.execute(req("unknown_action"));
  assert(!result.success, "should fail");
  assert(result.errorCode === "action_not_supported", `got ${result.errorCode}`);
});

// ── Results ──────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
