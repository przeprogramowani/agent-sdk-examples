# agent-sdk-examples

Runnable, minimal examples of programmatic agent usage. Each example is a small,
self-contained TypeScript script you can run with a single `npm` command — no
boilerplate, just the SDK feature it demonstrates.

Examples are run with [`tsx`](https://github.com/privatenumber/tsx), so there is
no build step.

## Setup

Requires **Node 22+** (see `.nvmrc`).

```bash
npm install
cp .env.example .env   # then fill in your keys
```

Every example loads `.env` at startup (via `dotenv`), so put your keys there:

```bash
ANTHROPIC_API_KEY=sk-ant-...    # anthropic/* examples (optional — see below)
OPENROUTER_API_KEY=sk-or-v1-... # ai-sdk/* examples (required)
```

`.env` is gitignored; `.env.example` is the committed template.

The **Claude Agent SDK** (`anthropic/*`) also runs through the locally installed
`claude` CLI and reuses its Claude Code login, so `ANTHROPIC_API_KEY` is optional
if that CLI is already authenticated. The **Vercel AI SDK** examples (`ai-sdk/*`)
have no implicit auth and always need `OPENROUTER_API_KEY`.

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
| `npm run anthropic:session` | [`review-with-session.ts`](./anthropic/review-with-session.ts) | **Session resume** — review once, then ask a follow-up that reuses the prior context without re-sending the diff. |
| `npm run anthropic:skill` | [`skill-autoload.ts`](./anthropic/skill-autoload.ts) | **Skill autoload** — the agent discovers and applies `.claude/skills/greeting` on its own. |
| `npm run anthropic:cost` | [`cost-report.ts`](./anthropic/cost-report.ts) | Reads **cost and token usage** from the result message and writes a report to `anthropic/cost.json`. |

## Claude Agent SDK — Python

The same code-review agent as `anthropic/review.ts`, but in **Python** with the
[`claude-agent-sdk`](https://github.com/anthropics/claude-agent-sdk-python)
package. It lives in [`anthropic-python/`](./anthropic-python) and adds one thing
the TypeScript version doesn't show: **swapping the model and routing through
OpenRouter**. Because the SDK runs the `claude` CLI as a subprocess, it inherits
Claude Code's env vars — so `ClaudeAgentOptions(env=...)` is all it takes to point
at OpenRouter.

Managed with [`uv`](https://docs.astral.sh/uv/) — `uv run` syncs the venv on
first use:

```bash
cd anthropic-python
uv run review.py                                          # OpenRouter if OPENROUTER_API_KEY is set, else direct
OPENROUTER_MODEL=openai/gpt-6-luna uv run review.py       # swap the OpenRouter model
OPENROUTER_API_KEY= uv run review.py                      # force direct Anthropic
```

Routing follows `OPENROUTER_API_KEY`: set → OpenRouter, empty/unset → direct
Anthropic. Since a `.env` typically carries that key for the `ai-sdk` examples,
runs default to OpenRouter; blank it with an empty shell var
(`OPENROUTER_API_KEY=`) for the direct path. See
[`anthropic-python/.env.example`](./anthropic-python/.env.example) for the full
list of env vars and caveats.

## Vercel AI SDK — assemble-it-yourself agent

The same code-review agent, built with the **Vercel AI SDK 7** (`ToolLoopAgent`)
instead of a batteries-included harness. Each example mirrors its `anthropic/`
counterpart so you can read the two categories side by side. The model is
imported explicitly — here **GLM via OpenRouter** (`z-ai/glm-5.3`) — so swapping
providers is a one-line change.

Authentication: unlike the Claude examples, these need an explicit key —
`OPENROUTER_API_KEY` in your `.env` (see [Setup](#setup)).

```bash
npm run aisdk:review              # uses data/sample-1.md
npm run aisdk:review -- sample-2  # uses data/sample-2.md
git diff | npm run aisdk:review   # review your working tree
```

| Script | File | What it shows |
|--------|------|---------------|
| `npm run aisdk:review` | [`review.ts`](./ai-sdk/review.ts) | A `ToolLoopAgent` returning **structured output** validated by a Zod schema (`Output.object`). |
| `npm run aisdk:session` | [`review-with-session.ts`](./ai-sdk/review-with-session.ts) | **No built-in session** — you carry a `messages[]` history yourself across two passes (structured review, then plain-text recall). |
| `npm run aisdk:rules` | [`rules-inject.ts`](./ai-sdk/rules-inject.ts) | **Nothing is inherited** — the SDK ignores `.claude/skills`, so the skill file is read from disk and injected into `instructions` manually. |
| `npm run aisdk:cost` | [`cost-report.ts`](./ai-sdk/cost-report.ts) | Reads **token usage** (`usage`, `onStepEnd`) plus OpenRouter's real **cost**, summed over `steps[].providerMetadata` (`usage: { include: true }`); writes `ai-sdk/cost.json`. |

## Evals — model comparison with promptfoo

Evals live in the [`packages/code-reviewer`](./packages/code-reviewer) package,
which wires its AI SDK review agent into [**promptfoo**](https://promptfoo.dev)
to compare OpenRouter models on a flawed React migration diff. It is a separate
package with its own dependencies and needs `OPENROUTER_API_KEY` (export it or
put it in `packages/code-reviewer/.env`). promptfoo requires **Node ≥ 22.22**
(the version pinned in `.nvmrc`):

```bash
cd packages/code-reviewer
npm install
npm run eval        # PROMPTFOO_DISABLE_TEMPLATING=true promptfoo eval -c evals/promptfooconfig.yaml --no-cache
npm run eval:view   # open the promptfoo web UI to browse results
```

The candidates are `z-ai/glm-5.3`, `deepseek/deepseek-v4.1-flash` and
`openai/gpt-6-luna`; the `llm-rubric` judge runs on
`openrouter:anthropic/claude-sonnet-5.5` (set via `defaultTest.options.provider`).
See [`packages/code-reviewer/evals/README.md`](./packages/code-reviewer/evals/README.md)
for the assertions and cost accounting.
