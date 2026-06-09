# agent-sdk-examples

Runnable, minimal examples of programmatic agent usage. Each example is a small,
self-contained TypeScript script you can run with a single `npm` command — no
boilerplate, just the SDK feature it demonstrates.

Examples are run with [`tsx`](https://github.com/privatenumber/tsx), so there is
no build step.

## Setup

```bash
npm install
```

Authentication: the examples use the **Claude Agent SDK**, which runs through the
locally installed `claude` CLI and reuses its Claude Code login. If you don't have
the CLI authenticated, set an API key instead:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Anthropic — Claude Agent SDK

Examples live in [`anthropic/`](./anthropic) and revolve around a small code-review
agent. The sample diffs they review are in [`data/`](./data) — by default the
scripts read `data/sample-1.md`; pass another sample as an argument, or pipe a real
diff via stdin:

```bash
npm run anthropic:review              # uses data/sample-1.md
npm run anthropic:review -- sample-2  # uses data/sample-2.md
git diff | npm run anthropic:review   # review your working tree
```

| Script | File | What it shows |
|--------|------|---------------|
| `npm run anthropic:review` | [`review.ts`](./anthropic/review.ts) | A focused review agent that returns **structured JSON output** enforced by a JSON Schema. |
| `npm run anthropic:tools` | [`review-with-tools.ts`](./anthropic/review-with-tools.ts) | An **in-process MCP tool** (`get_reviewable_diff`) that prunes noise (lockfiles, build output, snapshots) before the model reviews. |
| `npm run anthropic:session` | [`review-with-session.ts`](./anthropic/review-with-session.ts) | **Session resume** — review once, then ask a follow-up that reuses the prior context without re-sending the diff. |
| `npm run anthropic:skill` | [`skill-autoload.ts`](./anthropic/skill-autoload.ts) | **Skill autoload** — the agent discovers and applies `.claude/skills/greeting` on its own. |
| `npm run anthropic:cost` | [`cost-report.ts`](./anthropic/cost-report.ts) | Reads **cost and token usage** from the result message and writes a report to `anthropic/cost.json`. |

## Vercel AI SDK — assemble-it-yourself agent

The same code-review agent, built with the **Vercel AI SDK 6** (`ToolLoopAgent`)
instead of a batteries-included harness. Each example mirrors its `anthropic/`
counterpart so you can read the two categories side by side. The model is
imported explicitly — here **GLM via OpenRouter** (`z-ai/glm-5.1`) — so swapping
providers is a one-line change.

Authentication: unlike the Claude examples, these need an explicit key. Set
`OPENROUTER_API_KEY` before running:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npm run aisdk:review              # uses data/sample-1.md
npm run aisdk:review -- sample-2  # uses data/sample-2.md
git diff | npm run aisdk:review   # review your working tree
```

| Script | File | What it shows |
|--------|------|---------------|
| `npm run aisdk:review` | [`review.ts`](./ai-sdk/review.ts) | A `ToolLoopAgent` returning **structured output** validated by a Zod schema (`Output.object`). |
| `npm run aisdk:tools` | [`review-with-tools.ts`](./ai-sdk/review-with-tools.ts) | A custom **`tool()`** (`getReviewableDiff`) that prunes noise from a closure before the model reviews — `tools` is a record, input is `inputSchema`. |
| `npm run aisdk:session` | [`review-with-session.ts`](./ai-sdk/review-with-session.ts) | **No built-in session** — you carry a `messages[]` history yourself across two passes (structured review, then plain-text recall). |
| `npm run aisdk:rules` | [`rules-inject.ts`](./ai-sdk/rules-inject.ts) | **Nothing is inherited** — the SDK ignores `.claude/skills`, so the skill file is read from disk and injected into `instructions` manually. |
| `npm run aisdk:cost` | [`cost-report.ts`](./ai-sdk/cost-report.ts) | Reads **token usage** (`totalUsage`, `onStepFinish`) plus OpenRouter's real **cost** (`providerMetadata`, `usage: { include: true }`); writes `ai-sdk/cost.json`. |
