/**
 * installCasitaPlugin tests — verifies the install contract.
 * Run with: npx tsx tests/install.test.ts
 */

import { installCasitaPlugin } from "../src/index";
import type { DalePluginContext } from "../src/types";

// ── Minimal test harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
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

function mockCtx(): { ctx: DalePluginContext; connectorCalls: unknown[]; packCalls: unknown[] } {
  const connectorCalls: unknown[] = [];
  const packCalls: unknown[] = [];
  return {
    ctx: {
      connectors: { register: (a) => connectorCalls.push(a) },
      packs: { register: (p) => packCalls.push(p) },
    },
    connectorCalls,
    packCalls,
  };
}

// ── Tests ────────────────────────────────────────────────────────

console.log("\ninstallCasitaPlugin\n");

console.log("registration:");

test("registers exactly one connector", () => {
  const { ctx, connectorCalls } = mockCtx();
  installCasitaPlugin(ctx);
  assert(connectorCalls.length === 1, `expected 1 connector, got ${connectorCalls.length}`);
});

test("registers exactly one pack", () => {
  const { ctx, packCalls } = mockCtx();
  installCasitaPlugin(ctx);
  assert(packCalls.length === 1, `expected 1 pack, got ${packCalls.length}`);
});

console.log("\nmanifest:");

test("returns pluginId = casita", () => {
  const { ctx } = mockCtx();
  const manifest = installCasitaPlugin(ctx);
  assert(manifest.pluginId === "casita", `got ${manifest.pluginId}`);
});

test("returns valid semver version", () => {
  const { ctx } = mockCtx();
  const manifest = installCasitaPlugin(ctx);
  assert(/^\d+\.\d+\.\d+$/.test(manifest.version), `got ${manifest.version}`);
});

test("connectors list includes casita-api", () => {
  const { ctx } = mockCtx();
  const manifest = installCasitaPlugin(ctx);
  assert(manifest.connectors.includes("casita-api"), `connectors: ${manifest.connectors}`);
});

test("packs list includes casita-rentals", () => {
  const { ctx } = mockCtx();
  const manifest = installCasitaPlugin(ctx);
  assert(manifest.packs.includes("casita-rentals"), `packs: ${manifest.packs}`);
});

test("name is not empty", () => {
  const { ctx } = mockCtx();
  const manifest = installCasitaPlugin(ctx);
  assert(typeof manifest.name === "string" && manifest.name.length > 0, "name is empty");
});

test("apiBaseUrl is set", () => {
  const { ctx } = mockCtx();
  const manifest = installCasitaPlugin(ctx);
  assert(!!manifest.apiBaseUrl, "apiBaseUrl should be set");
});

console.log("\npack manifest:");

test("pack has 5 intents", () => {
  const { ctx, packCalls } = mockCtx();
  installCasitaPlugin(ctx);
  const pack = packCalls[0] as { intents: unknown[] };
  assert(pack.intents.length === 5, `expected 5 intents, got ${pack.intents.length}`);
});

test("pack has 5 graphs", () => {
  const { ctx, packCalls } = mockCtx();
  installCasitaPlugin(ctx);
  const pack = packCalls[0] as { graphs: unknown[] };
  assert(pack.graphs.length === 5, `expected 5 graphs, got ${pack.graphs.length}`);
});

test("verify_payment graph has a confirm node before the write node", () => {
  const { ctx, packCalls } = mockCtx();
  installCasitaPlugin(ctx);
  const pack = packCalls[0] as { graphs: Array<{ id: string; nodes: Array<{ id: string; policy: string }>; edges: Array<{ from: string; to: string }> }> };
  const graph = pack.graphs.find(g => g.id === "casita/verify-payment-v1");
  assert(!!graph, "verify-payment graph not found");

  const confirmNode = graph!.nodes.find(n => n.policy === "confirm");
  assert(!!confirmNode, "no confirm node in verify-payment graph");

  const writeNode = graph!.nodes.find(n => n.id === "verify_payment");
  assert(!!writeNode, "no verify_payment node found");

  const edgeFromConfirm = graph!.edges.find(e => e.from === confirmNode!.id && e.to === writeNode!.id);
  assert(!!edgeFromConfirm, "confirm node must directly precede verify_payment node");
});

test("create_casita graph has a confirm node before the write node", () => {
  const { ctx, packCalls } = mockCtx();
  installCasitaPlugin(ctx);
  const pack = packCalls[0] as { graphs: Array<{ id: string; nodes: Array<{ id: string; policy: string }>; edges: Array<{ from: string; to: string }> }> };
  const graph = pack.graphs.find(g => g.id === "casita/create-casita-v1");
  assert(!!graph, "create-casita graph not found");

  const confirmNode = graph!.nodes.find(n => n.policy === "confirm");
  assert(!!confirmNode, "no confirm node in create-casita graph");

  const writeNode = graph!.nodes.find(n => n.id === "create_casita");
  assert(!!writeNode, "no create_casita node found");

  const edgeFromConfirm = graph!.edges.find(e => e.from === confirmNode!.id && e.to === writeNode!.id);
  assert(!!edgeFromConfirm, "confirm node must directly precede create_casita node");
});

test("all keywords include 'casita' to avoid collisions", () => {
  const { ctx, packCalls } = mockCtx();
  installCasitaPlugin(ctx);
  const pack = packCalls[0] as { intents: Array<{ id: string; keywords: string[] }> };
  for (const intent of pack.intents) {
    const allHaveCasita = intent.keywords.every(kw => kw.toLowerCase().includes("casita"));
    assert(allHaveCasita, `intent ${intent.id} has keywords without 'casita': ${intent.keywords.filter(kw => !kw.toLowerCase().includes("casita")).join(", ")}`);
  }
});

// ── Results ──────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
