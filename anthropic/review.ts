import { query } from "@anthropic-ai/claude-agent-sdk";
import { readDiff } from "./utils";

// Wynik recenzji: pięć kryteriów (1-5) plus krótki komentarz
interface Review {
  correctness: number;
  security: number;
  performance: number;
  readability: number;
  testCoverage: number;
  comment: string;
}

// Rola recenzenta — wąska i przewidywalna, bez dziedziczenia z repo
const SYSTEM_PROMPT = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.
Zwróć wyłącznie ustrukturyzowany wynik zgodny ze schematem.`;

// JSON Schema egzekwowany przez SDK na wyjściu modelu
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "correctness",
    "security",
    "performance",
    "readability",
    "testCoverage",
    "comment",
  ],
  properties: {
    correctness: { type: "integer", minimum: 1, maximum: 5 },
    security: { type: "integer", minimum: 1, maximum: 5 },
    performance: { type: "integer", minimum: 1, maximum: 5 },
    readability: { type: "integer", minimum: 1, maximum: 5 },
    testCoverage: { type: "integer", minimum: 1, maximum: 5 },
    comment: { type: "string" },
  },
} as const;

// Proces review na podstawie git diffa
async function review(diff: string): Promise<Review> {

  // Konfiguracja agenta
  const result = query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      model: "claude-sonnet-4-6",
      tools: [],
      maxTurns: 2,
      outputFormat: { type: "json_schema", schema: REVIEW_SCHEMA },
    },
  });

  // Procesowanie odpowiedzi i ew. obsługa błędów
  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") {
      return message.structured_output as Review;
    }
    throw new Error(`Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`);
  }
  throw new Error("Agent nie zwrócił wyniku");
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
