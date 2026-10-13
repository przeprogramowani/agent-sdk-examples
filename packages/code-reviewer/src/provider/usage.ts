/**
 * Cost/token accounting, normalized from the AI SDK + OpenRouter into one shape
 * the rest of the package (and the promptfoo eval) can report.
 *
 * Token counts come from each step's `usage` (the standard AI SDK fields); the
 * dollar `cost` comes from OpenRouter's usage-accounting block on each step's
 * `providerMetadata.openrouter.usage` — present only when the model was built
 * with `OPENROUTER_USAGE_ACCOUNTING` (see ./openrouter.ts). Everything is summed
 * across steps so a multi-step tool-loop run reports its whole cost, not just
 * the final turn. No side effects.
 */

/** Normalized usage for one review run (summed across all model steps). */
export interface ReviewUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  /** Total USD cost as reported by OpenRouter; undefined if no step reported it. */
  cost?: number;
  /** How many model round-trips (steps) the run took. */
  numRequests: number;
}

/** Read a value as a finite number, defaulting to 0. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Fold an AI SDK result's `steps` into a single `ReviewUsage`. Accepts `unknown[]`
 * so it stays decoupled from the SDK's step type (whose `providerMetadata` is a
 * generic record); each field is read defensively.
 */
export function extractUsage(steps: readonly unknown[]): ReviewUsage {
  const acc: ReviewUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    numRequests: steps.length,
  };

  let cost = 0;
  let sawCost = false;

  for (const step of steps) {
    const s = step as { usage?: Record<string, unknown>; providerMetadata?: Record<string, unknown> };
    const u = s.usage ?? {};
    // AI SDK 7 nests cache/reasoning counts under `inputTokenDetails` / `outputTokenDetails`.
    const inputDetails = (u.inputTokenDetails ?? {}) as Record<string, unknown>;
    const outputDetails = (u.outputTokenDetails ?? {}) as Record<string, unknown>;
    acc.promptTokens += num(u.inputTokens);
    acc.completionTokens += num(u.outputTokens);
    acc.totalTokens += num(u.totalTokens);
    acc.cachedTokens += num(inputDetails.cacheReadTokens);
    acc.reasoningTokens += num(outputDetails.reasoningTokens);

    const openrouter = s.providerMetadata?.openrouter as { usage?: Record<string, unknown> } | undefined;
    const orCost = openrouter?.usage?.cost;
    if (typeof orCost === "number" && Number.isFinite(orCost)) {
      cost += orCost;
      sawCost = true;
    }
  }

  if (sawCost) acc.cost = cost;
  return acc;
}
