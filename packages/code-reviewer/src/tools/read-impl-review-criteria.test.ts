import { describe, expect, it } from "vitest";
import { readImplReviewCriteriaTool, loadImplReviewCriteria } from "./read-impl-review-criteria.js";
import type { ImplReviewCriteria } from "./read-impl-review-criteria.js";

/**
 * Exercises the tool's `execute` against the criteria shipped with this package
 * (`.agents/skills/10x-impl-review-ci/references/impl-review-instructions.md`).
 */

// The AI SDK tool keeps `execute` optional in its type; assert it is present.
function runReadCriteria(): Promise<ImplReviewCriteria> {
  const execute = readImplReviewCriteriaTool.execute;
  if (!execute) throw new Error("readImplReviewCriteriaTool.execute is undefined");
  return execute({}, { toolCallId: "test", messages: [], context: {} }) as Promise<ImplReviewCriteria>;
}

describe("readImplReviewCriteriaTool", () => {
  it("returns the shipped implementation-review criteria", async () => {
    const result = await runReadCriteria();
    expect(result.criteria).toContain("Implementation Review Criteria");
    expect(result.criteria).toBe(await loadImplReviewCriteria());
  });
});
