import { describe, expect, it } from "vitest";
import { extractUsage } from "./usage.js";

/**
 * extractUsage folds AI SDK steps into one normalized usage record: token fields
 * sum across steps, OpenRouter's per-step dollar cost sums into `cost`, and cost
 * is left undefined when no step reported one. Steps are typed loosely (the SDK's
 * providerMetadata is a generic record), so these use plain shaped objects.
 */
describe("extractUsage", () => {
  it("sums tokens and cost across multiple steps", () => {
    const steps = [
      {
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          inputTokenDetails: { cacheReadTokens: 10 },
          outputTokenDetails: { reasoningTokens: 5 },
        },
        providerMetadata: { openrouter: { usage: { cost: 0.001 } } },
      },
      {
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
        providerMetadata: { openrouter: { usage: { cost: 0.0005 } } },
      },
    ];

    expect(extractUsage(steps)).toEqual({
      promptTokens: 150,
      completionTokens: 30,
      totalTokens: 180,
      cachedTokens: 10,
      reasoningTokens: 5,
      cost: 0.0015,
      numRequests: 2,
    });
  });

  it("leaves cost undefined when no step reports one (accounting off)", () => {
    const steps = [{ usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } }];

    const usage = extractUsage(steps);

    expect(usage.cost).toBeUndefined();
    expect(usage).toMatchObject({ promptTokens: 10, completionTokens: 2, totalTokens: 12, numRequests: 1 });
  });

  it("treats missing/zero steps as a zeroed record", () => {
    expect(extractUsage([])).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      numRequests: 0,
    });
  });

  it("ignores malformed usage/metadata without throwing", () => {
    const steps = [
      { usage: { inputTokens: "oops" }, providerMetadata: { openrouter: { usage: { cost: "free" } } } },
      {},
    ];

    expect(extractUsage(steps)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      numRequests: 2,
    });
  });
});
