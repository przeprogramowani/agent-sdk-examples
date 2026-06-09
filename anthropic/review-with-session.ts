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
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.`;

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

const baseOptions = {
  systemPrompt: SYSTEM_PROMPT,
  model: "claude-sonnet-4-6",
  maxTurns: 2,
} as const;

// Pierwszy przebieg: zrecenzuj diff i zapamiętaj id sesji
async function firstPass(
  diff: string,
): Promise<{ sessionId: string; review: Review }> {
  let sessionId: string | undefined;
  let review: Review | undefined;

  for await (const message of query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      ...baseOptions,
      outputFormat: { type: "json_schema", schema: REVIEW_SCHEMA },
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    }
    if (message.type === "result") {
      if (message.subtype === "success") {
        review = message.structured_output as Review;
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

// Drugi przebieg: wznów tę samą sesję i odwołaj się do poprzedniej analizy.
// Świadomie NIE podajemy diffa ponownie — jeśli sesja pamięta, agent i tak wie, co recenzował.
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

// Entry point: query → stop → sessionId → resume → complete
const diff = await readDiff();

const { sessionId, review } = await firstPass(diff);
console.error(`\n[1] sesja: ${sessionId}`);
console.error("[1] recenzja:");
console.log(JSON.stringify(review, null, 2));

const recalled = await secondPass(sessionId);
console.error("\n[2] po wznowieniu sesji (bez ponownego diffa):");
console.log(recalled);
