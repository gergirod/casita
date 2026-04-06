import type { DalePluginContext, DalePluginInstaller, DalePluginManifest } from "./types";
import { CasitaConnector } from "./connector";
import { casitaPack } from "./pack";

export { CasitaConnector } from "./connector";
export { casitaPack } from "./pack";
export type { DalePluginManifest } from "./types";

/**
 * Install the Casita plugin into a Dale runtime.
 *
 * Usage in Dale bootstrap:
 *   import { installCasitaPlugin } from '@casita/dale-plugin';
 *   const manifest = installCasitaPlugin({ connectors, packs });
 *
 * Required credential in Dale vault (per workspace):
 *   { "token": "<casita-machine-jwt>", "url": "https://your-casita.app" }
 *
 * Generate the token: POST /api/v1/token on your Casita instance
 * (requires an active owner session in the Casita dashboard).
 */
export const installCasitaPlugin: DalePluginInstaller = (
  ctx: DalePluginContext,
): DalePluginManifest => {
  ctx.connectors.register(new CasitaConnector());
  ctx.packs.register(casitaPack);

  return {
    pluginId: "casita",
    name: "Casita Rentals Plugin",
    version: "1.0.0",
    connectors: ["casita-api"],
    packs: ["casita-rentals"],
    apiBaseUrl: "https://casita.app/api/v1",
    docsUrl: "https://github.com/gergirod/casita#dale-plugin",
  };
};
