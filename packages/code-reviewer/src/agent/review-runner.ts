import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ToolLoopAgent } from "ai";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { readPlanTool } from "../tools/read-plan.js";
import { readImplReviewCriteriaTool } from "../tools/read-impl-review-criteria.js";
import { postPrCommentTool } from "../tools/post-pr-comment.js";
import { REVIEW_SYSTEM_INSTRUCTIONS, buildReviewPrompt } from "../prompts/review.js";
import type { ReviewInput } from "../prompts/review.js";
import { getOpenRouter, resolveModelId, OPENROUTER_USAGE_ACCOUNTING } from "../provider/openrouter.js";
import { extractUsage } from "../provider/usage.js";
import { trace, phase, summarize } from "../log.js";

/**
 * The agentic CI review flow: a single `ToolLoopAgent` equipped with `readPlan`,
 * `readImplReviewCriteria`, and `postPrComment`. Unlike `reviewCode` (the pure
 * scorer kept for evals), this drops `Output.object` — the structured review
 * lives in the model's `postPrComment` tool call, and the side effect (posting)
 * happens inside the loop. The overall verdict is recovered afterward from the
 * `code` tool call.
 *
 * Two steps, both encoded in the instructions so the model performs detection:
 *   1. Code review — always.
 *   2. Implementation review — only when the PR references a plan. This judges
 *      the diff *against* that plan (adherence + scope), and is deliberately NOT
 *      a "plan review" of the plan's own quality.
 */

export interface RunReviewOptions {
  /** OpenRouter model id; defaults to OPENROUTER_MODEL env var or a sane default. */
  model?: string;
  /** Inject a pre-built OpenRouter provider (e.g. in tests). */
  provider?: OpenRouterProvider;
}

/** The recovered outcome of an agentic review run. */
export interface RunReviewResult {
  /** Authoritative code-review verdict; `fail` if no code comment was posted. */
  verdict: "pass" | "fail";
  /** How many comments the agent posted this run (code + optional implementation review). */
  postedComments: number;
}

/** The orchestration prompt template, shipped alongside this module as markdown. */
const RUNNER_PROMPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prompts", "review-runner.md");

/** Placeholder in the template where the code-review rubric is spliced in. */
const RUBRIC_PLACEHOLDER = "{{CODE_REVIEW_RUBRIC}}";

/**
 * Orchestration guidance composed with the code-review rubric. The procedure
 * lives in `src/prompts/review-runner.md` (single editable source of truth); we
 * read it at module load and splice the rubric into the placeholder. A read
 * failure is a packaging error and is allowed to throw.
 */
export const REVIEW_RUNNER_INSTRUCTIONS = readFileSync(RUNNER_PROMPT_PATH, "utf8").replace(
  RUBRIC_PLACEHOLDER,
  REVIEW_SYSTEM_INSTRUCTIONS
);

/** Build the agentic reviewer for the resolved model. */
export function createReviewRunnerAgent(opts: RunReviewOptions = {}) {
  const modelId = resolveModelId(opts.model);
  const provider = opts.provider ?? getOpenRouter();
  trace(`agent created · model=${modelId} · tools=[readPlan, readImplReviewCriteria, postPrComment]`);

  // Per-agent step counter so each run's trace is independently numbered, plus a
  // running token tally so the trace shows cumulative cost as the loop proceeds.
  let stepNumber = 0;
  const cumulativeUsage = { input: 0, output: 0, total: 0 };
  return new ToolLoopAgent({
    // Usage accounting on, so per-step + cumulative token/dollar cost is traceable.
    model: provider(modelId, OPENROUTER_USAGE_ACCOUNTING),
    instructions: REVIEW_RUNNER_INSTRUCTIONS,
    tools: {
      readPlan: readPlanTool,
      readImplReviewCriteria: readImplReviewCriteriaTool,
      postPrComment: postPrCommentTool,
    },
    // Fires after each model turn + its tool executions complete; the single
    // hook that lets us trace the whole loop (calls, results, usage) from here
    // without threading logging through every tool.
    onStepEnd: (step) => {
      const n = ++stepNumber;
      const callCount = step.toolCalls.length;
      trace(
        `step ${n} complete · ${callCount} tool call${callCount === 1 ? "" : "s"}` +
          (callCount ? ` (${step.toolCalls.map((c) => c.toolName).join(", ")})` : " (model turn only)")
      );
      for (const call of step.toolCalls) {
        trace(`step ${n} → call ${call.toolName}(${summarize(call.input)})`);
      }
      for (const result of step.toolResults) {
        trace(`step ${n} ← result ${result.toolName} ⇒ ${summarize(result.output)}`);
      }
      const reasoning = step.text.trim();
      if (reasoning) {
        trace(`step ${n} · model said: ${summarize(reasoning)}`);
      }
      const { inputTokens, outputTokens, totalTokens } = step.usage;
      cumulativeUsage.input += inputTokens ?? 0;
      cumulativeUsage.output += outputTokens ?? 0;
      cumulativeUsage.total += totalTokens ?? 0;
      trace(
        `step ${n} done · finishReason=${step.finishReason} · ` +
          `tokens in=${inputTokens ?? "?"} out=${outputTokens ?? "?"} total=${totalTokens ?? "?"} · ` +
          `cumulative total=${cumulativeUsage.total}`
      );
    },
  });
}

/** A tool call as exposed on `result.steps`; only the fields we read are typed. */
interface ToolCallLike {
  toolName: string;
  input: unknown;
}
interface StepLike {
  toolCalls?: ToolCallLike[];
}

/**
 * Recover the run's outcome from the agent steps: the verdict comes from the
 * `postPrComment` call whose payload kind is `code`; if no code comment was
 * posted (error path), default to `fail` so a broken run never silently passes.
 */
export function recoverOutcome(steps: StepLike[]): RunReviewResult {
  const postCalls = steps.flatMap((step) => step.toolCalls ?? []).filter((call) => call.toolName === "postPrComment");

  let verdict: "pass" | "fail" = "fail";
  for (const call of postCalls) {
    const input = call.input as { kind?: string; review?: { verdict?: unknown } } | null;
    if (input?.kind === "code") {
      verdict = input.review?.verdict === "pass" ? "pass" : "fail";
    }
  }

  return { verdict, postedComments: postCalls.length };
}

/**
 * Run the agentic review: code review (always) plus a conditional implementation
 * review against the plan, posting 1–2 comments via the tools, and return the
 * recovered overall verdict.
 */
export async function runReview(input: ReviewInput, options: RunReviewOptions = {}): Promise<RunReviewResult> {
  phase("REVIEW START");
  trace(
    `input · title=${summarize(input.title, 80)} · ` +
      `description=${input.description.length} chars · diff=${input.diff.length} chars`
  );

  const agent = createReviewRunnerAgent(options);

  trace("invoking agent loop (code review always; implementation review when a plan is referenced)…");
  const startedAt = Date.now();
  const { steps } = await agent.generate({ prompt: buildReviewPrompt(input) });
  const elapsedMs = Date.now() - startedAt;

  const outcome = recoverOutcome(steps);
  const usage = extractUsage(steps);
  phase("REVIEW DONE");
  trace(
    `outcome · verdict=${outcome.verdict} · commentsPosted=${outcome.postedComments} · ` +
      `steps=${steps.length} · elapsed=${elapsedMs}ms · ` +
      `tokens=${usage.totalTokens} · cost=${usage.cost != null ? `$${usage.cost.toFixed(6)}` : "—"}`
  );
  return outcome;
}
