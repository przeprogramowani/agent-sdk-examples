import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { trace } from "../log.js";

/**
 * Owns all environment access and OpenRouter provider construction, so the rest
 * of the package is provider-agnostic and the env file loads exactly once, here,
 * at the right time (before any consumer reads `OPENROUTER_API_KEY`).
 */

// Node 22+ loads `.env` natively — no `dotenv` dependency needed.
try {
  process.loadEnvFile();
} catch {
  // No local .env file; rely on the ambient environment instead.
}

/** Default OpenRouter model id when none is supplied via options or env. */
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/**
 * Per-model settings that turn on OpenRouter usage accounting, so each response
 * carries `providerMetadata.openrouter.usage` (token counts + dollar `cost`).
 * Pass this when building a model — `provider(modelId, OPENROUTER_USAGE_ACCOUNTING)`
 * — so `extractUsage` (see ./usage.ts) can recover what the run cost.
 * https://openrouter.ai/docs/use-cases/usage-accounting
 */
export const OPENROUTER_USAGE_ACCOUNTING = { usage: { include: true } } as const;

/** Construct an OpenRouter provider, throwing a helpful error if the key is absent. */
export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key " +
        "(get one at https://openrouter.ai/keys)."
    );
  }
  // Confirm the key is present without ever logging the key itself.
  trace(`openrouter · provider configured (api key present, ${apiKey.length} chars)`);
  return createOpenRouter({ apiKey });
}

/** Resolve the model id in precedence order: explicit → OPENROUTER_MODEL env → default. */
export function resolveModelId(explicit?: string): string {
  const source = explicit ? "option" : process.env.OPENROUTER_MODEL ? "OPENROUTER_MODEL env" : "default";
  const modelId = explicit ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  trace(`openrouter · model resolved to ${modelId} (from ${source})`);
  return modelId;
}
