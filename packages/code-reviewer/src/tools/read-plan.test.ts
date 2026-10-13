import { describe, expect, it } from "vitest";
import { readPlanTool } from "./read-plan.js";
import type { ReadPlanResult } from "./read-plan.js";

/**
 * Exercises the tool's `execute` against this repo itself, which genuinely
 * carries `context/changes/plan-reading-tool/plan.md`. Covers the found path,
 * the non-throwing not-found path, and the throwing invalid-input paths.
 */

// The AI SDK tool keeps `execute` optional in its type; assert it is present.
function runReadPlan(target: string): Promise<ReadPlanResult> {
  const execute = readPlanTool.execute;
  if (!execute) throw new Error("readPlanTool.execute is undefined");
  return execute({ target }, { toolCallId: "test", messages: [], context: {} }) as Promise<ReadPlanResult>;
}

describe("readPlanTool", () => {
  it("reads an existing plan by change-id", async () => {
    const result = await runReadPlan("example");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.changeId).toBe("example");
      expect(result.path).toContain("context/changes/example/plan.md");
      expect(result.contents).toContain("Implementation Plan");
    }
  });

  it("returns { found: false } for a missing plan rather than throwing", async () => {
    const result = await runReadPlan("no-such-change-zzz");
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.target).toBe("no-such-change-zzz");
      expect(result.message).toContain("No plan found");
    }
  });

  it("throws on a path escaping context/changes/", async () => {
    await expect(runReadPlan("context/changes/../../../etc/passwd")).rejects.toThrow();
  });

  it("throws on an empty target", async () => {
    await expect(runReadPlan("")).rejects.toThrow();
  });
});
