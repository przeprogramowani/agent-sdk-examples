import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { readDiff } from "./utils";

// Rola recenzenta — w wersji do złożenia trafia do pola `instructions`
const INSTRUCTIONS = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.
Zwróć wyłącznie ustrukturyzowany wynik zgodny ze schematem.`;

// Schemat zoda (nie JSON Schema jak w harnessie) — z niego Output.object składa structured output
const REVIEW_SCHEMA = z.object({
  correctness: z.number().int().min(1).max(5),
  security: z.number().int().min(1).max(5),
  performance: z.number().int().min(1).max(5),
  readability: z.number().int().min(1).max(5),
  testCoverage: z.number().int().min(1).max(5),
  comment: z.string(),
});

type Review = z.infer<typeof REVIEW_SCHEMA>;

// Proces review na podstawie git diffa
async function review(diff: string): Promise<Review> {
  // Wykorzystanie tzw. pętli agentowej z AI SDK 6
  const reviewer = new ToolLoopAgent({
    model: openrouter("z-ai/glm-5.1"), // model importujesz jawnie — podmiana dostawcy to jedna linijka
    instructions: INSTRUCTIONS,
    tools: {}, // na ten moment bez niestandardowych narzędzi
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2), // odpowiednik maxTurns: recenzja + emisja structured output
  });

  const { output } = await reviewer.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
  });
  return output;
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
