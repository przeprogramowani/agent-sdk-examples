# Evals — review-prompt model sweep

[promptfoo](https://www.promptfoo.dev) evaluation of the `reviewCode` agent as a
**model sweep**: the same review prompt runs across three OpenRouter models
against **one** hand-authored React 16→19 migration diff carrying **three**
documented flaws. Two assertion layers verify each model's output — a
deterministic TypeScript static check and three per-flaw LLM judges.

## Prerequisites

- `OPENROUTER_API_KEY` in `packages/code-reviewer/.env` (copy `.env.example`).
  The sweep makes real, billed model calls on every run.

## Run

From `packages/code-reviewer/`:

```bash
npm run eval        # run the sweep (3 review calls + up to 9 judge calls, --no-cache)
npm run eval:view   # open the promptfoo web viewer for the last run
```

`npm run eval` sets `PROMPTFOO_DISABLE_TEMPLATING=true` — the provider reads the
PR vars directly and ignores promptfoo's prompt templating, and the fixture's
JSX `{{ … }}` braces would otherwise collide with nunjucks. The LLM-judge grader
path is exempt from this flag, so the rubrics still render.

## Run the whole solution locally (no PR, no posting)

`npm run review:local` drives the **actual CI entry point** (`src/cli.ts`) — the
same one the GitHub Action invokes — against a fixture, reusing the exact PR
metadata + diff this eval consumes:

```bash
npm run review:local                  # default fixture: react-migration
npm run review:local -- <fixture>     # any <fixture>.* set under fixtures/
```

It sets `PR_TITLE`/`PR_DESCRIPTION` from the fixtures, pipes the diff in on
stdin, and leaves the GitHub env unset, so the engine runs in **dry-run**: a
real (billed) OpenRouter review whose rendered comment goes to stderr instead of
being posted, with the `{ verdict }` JSON on stdout checked against
`<fixture>.expected-verdict.txt`.

### Shared fixtures (single source of truth)

Both this eval (via `file://` refs in `promptfooconfig.yaml`) and the launcher
read the same files under `fixtures/`:

| File | Feeds |
| --- | --- |
| `<base>.title.txt` | `PR_TITLE` / promptfoo `title` var |
| `<base>.description.txt` | `PR_DESCRIPTION` / promptfoo `description` var |
| `<base>.diff` | stdin diff / promptfoo `diff` var |
| `<base>.expected-verdict.txt` | launcher assertion / promptfoo `expected_verdict` var |

## The test case

A single PR: `fixtures/react-migration.diff` — a `UserCard` class→function
migration (hooks + `createRoot`) seeded with three flaws, one per criterion.
The ground truth lives in [`fixtures/react-migration.flaws.md`](./fixtures/react-migration.flaws.md):

1. **XSS** via `dangerouslySetInnerHTML` on untrusted `bio` → `securitySafety`.
2. **Stale-closure `useEffect`** (empty deps, never refetches on `userId`
   change) → `implementationCorrectness`.
3. **`defaultProps` on a function component** (ignored in React 19) →
   `idiomaticity`.

## The models compared

Listed as three `providers:` entries in `promptfooconfig.yaml`, all pointing at
the same `reviewProvider.ts` with a different `config.model`:

- `z-ai/glm-5.3`
- `deepseek/deepseek-v4.1-flash`
- `openai/gpt-6-luna`

## The assertions

Each model's `ReviewResult` is checked by:

- **Static fail-check** (`asserts/reviewFails.ts`, `type: javascript`) — no LLM,
  deterministic: the `verdict` must be `fail` and every one of the six criterion
  scores must be an integer in 1–10 with a rationale. This enforces the 1–10
  integer contract the JSON schema deliberately can't (Anthropic structured
  output rejects `minimum`/`maximum`/`.int()` on integers).
- **Three `llm-rubric` judges** — one per planted flaw, graded by
  `openrouter:anthropic/claude-sonnet-5.5` (set via `defaultTest.options.provider`
  because the default grader is OpenAI and no OpenAI key is available). Each
  rubric is phrased to pass **only** on genuine identification of that specific
  flaw, not generic boilerplate.

Read each model's full `ReviewResult` and the judge's per-flaw reasoning in
`npm run eval:view`.

## Cost & token accounting

Each provider call back-propagates its usage to promptfoo, so the results table
and `npm run eval:view` show **per-cell token counts and dollar cost** (and roll
them into the run totals). `reviewProvider.ts` calls `reviewCodeWithUsage`, which
recovers usage from the model steps via `src/provider/usage.ts`; the dollar
figure is OpenRouter's own `cost`, available because models are built with
`OPENROUTER_USAGE_ACCOUNTING` (`{ usage: { include: true } }`). The promptfoo
`ProviderResponse` carries it as `cost` plus a `tokenUsage` breakdown
(`prompt` / `completion` / `total` / `cached` / `numRequests` / reasoning). This
makes the sweep a cost comparison, not just a quality one — a model that catches
every flaw but costs 10× is visible at a glance. Cost is omitted (not zero) for
any model whose OpenRouter route doesn't report it.

## Caveat — run-to-run variance

There is **no temperature pinning** (on the agent or the grader), so scores,
verdict, and which flaws a given model names vary run to run. A model can catch
a flaw on one run and miss it on the next; the strongest model does not always
win on every flaw. Treat a single run as a sample, not a verdict — re-run, or
read the judge reasoning, before drawing conclusions. This is an accepted
trade-off for this MVP eval.
