import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  REVIEW_JSON_SCHEMA,
  REVIEWER_PROMPT,
  ReviewResult,
} from "../common/review-schema";
import { readDiff } from "./utils";

async function review(diff: string): Promise<ReviewResult> {
  const result = query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      systemPrompt: `${REVIEWER_PROMPT}`,
      model: "claude-sonnet-5-5",
      tools: [],
      // Recenzent ma być odcięty od CLAUDE.md i ustawień z cwd — bez tego
      // query() wczytuje je domyślnie, niezależnie od systemPrompt.
      settingSources: [],
      maxTurns: 2,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  });

  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") {
      // structured_output jest typowany jako unknown — walidujemy po swojej stronie
      const parsed = ReviewResult.safeParse(message.structured_output);
      if (!parsed.success) {
        throw new Error(`Niepoprawny structured output: ${parsed.error.message}`);
      }
      return parsed.data;
    }
    throw new Error(`Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`);
  }
  throw new Error("Agent nie zwrócił wyniku");
}

const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
