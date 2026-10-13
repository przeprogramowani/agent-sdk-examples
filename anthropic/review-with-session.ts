import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { REVIEW_JSON_SCHEMA, REVIEWER_PROMPT, ReviewResult } from "../common/review-schema";
import { readDiff } from "./utils";


const baseOptions = {
  systemPrompt: REVIEWER_PROMPT,
  model: "claude-sonnet-5-5",
  maxTurns: 2,
} as const;

async function firstPass(
  diff: string,
): Promise<{ sessionId: string; review: ReviewResult }> {
  let sessionId: string | undefined;
  let review: ReviewResult | undefined;

  for await (const message of query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      ...baseOptions,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    }
    if (message.type === "result") {
      if (message.subtype === "success") {
        // structured_output jest typowany jako unknown — walidujemy po swojej stronie
        const parsed = ReviewResult.safeParse(message.structured_output);
        if (!parsed.success) {
          throw new Error(`Niepoprawny structured output: ${parsed.error.message}`);
        }
        review = parsed.data;
      } else {
        throw new Error(
          `Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`,
        );
      }
    }
  }

  if (!sessionId) throw new Error("Nie złapano session_id z wiadomości init");
  if (!review) throw new Error("Agent nie zwrócił wyniku");
  return { sessionId, review };
}

async function secondPass(sessionId: string): Promise<string> {
  const result = query({
    prompt:
      "Bez ponownego wczytywania diffa: który plik recenzowałeś i które kryterium dostało najniższą ocenę? Odpowiedz krótko, zwykłym tekstem.",
    options: { ...baseOptions, resume: sessionId },
  });

  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") return message.result;
    throw new Error(`Druga tura nie powiodła się (${message.subtype})`);
  }
  throw new Error("Brak wyniku z drugiej tury");
}

const diff = await readDiff();

const { sessionId, review } = await firstPass(diff);
console.error(`\n[1] sesja: ${sessionId}`);
console.error("[1] recenzja:");
console.log(JSON.stringify(review, null, 2));

const recalled = await secondPass(sessionId);
console.error("\n[2] po wznowieniu sesji (bez ponownego diffa):");
console.log(recalled);
