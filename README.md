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
