import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { postPrCommentTool } from "./post-pr-comment.js";
import type { PostResult } from "./post-pr-comment.js";
import type { ReviewResult } from "../schemas/review.js";
import type { PlanReviewResult } from "../schemas/plan-review.js";

/**
 * Verifies PR-number-gated posting without invoking real `gh`: the exec boundary
 * is mocked, so we assert it posts whenever a PR number is resolvable (CI or a
 * local run with PR_NUMBER set), with the PR number and a `--body-file` (never
 * inline); skips with no PR target; always renders the body to stderr; and that
 * `code`/`plan` payloads route to the right renderer.
 */
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const mockExec = vi.mocked(execFileSync);

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockExec.mockClear();
  // Start each test from a clean env without GitHub signals.
  delete process.env.GITHUB_ACTIONS;
  delete process.env.PR_NUMBER;
  delete process.env.DIFF_TRUNCATED;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

const codeReview: ReviewResult = {
  criteria: {
    implementationCorrectness: { score: 9, rationale: "r" },
    idiomaticity: { score: 8, rationale: "r" },
    complexity: { score: 7, rationale: "r" },
    testRiskCoverage: { score: 6, rationale: "r" },
    documentation: { score: 5, rationale: "r" },
    securitySafety: { score: 10, rationale: "r" },
  },
  verdict: "pass",
  summary: "ok",
};

const planReview: PlanReviewResult = {
  criteria: {
    planAdherence: { score: 8, rationale: "r" },
    scopeDiscipline: { score: 9, rationale: "r" },
  },
  unimplementedItems: [],
  unplannedChanges: [],
  verdict: "pass",
  summary: "ok",
};

function run(payload: unknown): Promise<PostResult> {
  const execute = postPrCommentTool.execute;
  if (!execute) throw new Error("postPrCommentTool.execute is undefined");
  return execute(payload as never, { toolCallId: "t", messages: [], context: {} }) as Promise<PostResult>;
}

describe("postPrCommentTool", () => {
  it("posts via gh in GitHub env, passing --body-file", async () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.PR_NUMBER = "42";

    const result = await run({ kind: "code", review: codeReview });

    expect(result).toEqual({ posted: true, kind: "code" });
    expect(mockExec).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExec.mock.calls[0] ?? [];
    expect(cmd).toBe("gh");
    expect(args).toEqual(["pr", "comment", "42", "--body-file", expect.any(String)]);
    // Body is passed by file, never inline.
    expect(args).not.toContain("--body");
  });

  it("posts locally (no GITHUB_ACTIONS) whenever PR_NUMBER is set", async () => {
    // No GITHUB_ACTIONS — a plain local run with an explicit PR target still posts.
    process.env.PR_NUMBER = "7";

    const result = await run({ kind: "code", review: codeReview });

    expect(result).toEqual({ posted: true, kind: "code" });
    expect(mockExec).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExec.mock.calls[0] ?? [];
    expect(cmd).toBe("gh");
    expect(args).toEqual(["pr", "comment", "7", "--body-file", expect.any(String)]);
  });

  it("does not invoke gh with no PR target, but still renders the body", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    });

    const result = await run({ kind: "code", review: codeReview });

    expect(result).toEqual({ posted: false, reason: "no-pr-number", kind: "code" });
    expect(mockExec).not.toHaveBeenCalled();
    expect(writes.join("")).toContain("AI Code Review");
  });

  it("renders the body even when it posts (observable in CI logs)", async () => {
    process.env.PR_NUMBER = "99";
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    });

    const result = await run({ kind: "code", review: codeReview });

    expect(result).toEqual({ posted: true, kind: "code" });
    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(writes.join("")).toContain("AI Code Review");
  });

  it("routes a plan payload to the plan renderer", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    });

    const result = await run({ kind: "plan", review: planReview });

    expect(result).toEqual({ posted: false, reason: "no-pr-number", kind: "plan" });
    expect(writes.join("")).toContain("AI Plan-Implementation Review");
  });
});
