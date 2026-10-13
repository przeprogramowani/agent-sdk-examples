# @10x/code-reviewer

AI-powered code reviewer built on the [Vercel AI SDK](https://ai-sdk.dev) (`ai`),
the [OpenRouter](https://openrouter.ai) provider, and [zod](https://zod.dev) for
schema-validated, type-safe results. Runs on Node + TypeScript via `tsx` (no build step).

## Setup

```bash
npm install
cp .env.example .env   # then add your OPENROUTER_API_KEY
```

## Scripts

- `npm start` — run the entry point once (demo review).
- `npm run dev` — run with `tsx watch` (reloads on change).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run eval` — run the promptfoo model sweep (see [`evals/`](./evals/README.md)).
- `npm run eval:view` — open the promptfoo web viewer for the last run.

## Entry point

`src/index.ts` exposes:

```ts
reviewCode(
  input: { title: string; description: string; diff: string },
  options?: { model?: string }
): Promise<ReviewResult>;
```

It reviews a pull request (title + description + unified diff) and returns a
validated `ReviewResult`:

- `criteria` — six 1–10 scored criteria (`implementationCorrectness`,
  `idiomaticity`, `complexity`, `testRiskCoverage`, `documentation`,
  `securitySafety`), each `{ score, rationale }`.
- `verdict` — authoritative `"pass" | "fail"` for the change.
- `summary` — a markdown summary ready to post as a PR comment.

`options.model` overrides the OpenRouter model id (otherwise `OPENROUTER_MODEL`
env, then a default). This is the single integration point the rest of the
project builds on; import it directly:

```ts
import { reviewCode } from "./src/index.ts";

const result = await reviewCode(
  { title: "Fix off-by-one in pager", description: "…", diff },
  { model: "anthropic/claude-sonnet-5.5" }
);
console.log(result.verdict, result.criteria.securitySafety.score);
```

## Evals

`evals/` holds a [promptfoo](https://www.promptfoo.dev) model sweep that runs the
review prompt across several OpenRouter models against a flawed React migration
diff. See [`evals/README.md`](./evals/README.md).
