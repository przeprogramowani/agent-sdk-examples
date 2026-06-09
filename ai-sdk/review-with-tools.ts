import { ToolLoopAgent, Output, tool, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { readDiff } from "./utils";

// Rola recenzenta — w wersji do złożenia trafia do pola `instructions`
const INSTRUCTIONS = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.
Zwróć wyłącznie ustrukturyzowany wynik zgodny ze schematem.`;

// Schemat zoda — z niego Output.object składa structured output
const REVIEW_SCHEMA = z.object({
  correctness: z.number().int().min(1).max(5),
  security: z.number().int().min(1).max(5),
  performance: z.number().int().min(1).max(5),
  readability: z.number().int().min(1).max(5),
  testCoverage: z.number().int().min(1).max(5),
  comment: z.string(),
});

type Review = z.infer<typeof REVIEW_SCHEMA>;

// Pliki, które w recenzji tylko zasłaniają sygnał: lockfile'y, build, snapshoty.
const NOISE = [
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
  /(^|\/)dist\//,
  /\.snap$/,
];

function pruneDiff(diff: string) {
  // każdy plik w unified diffie zaczyna się od nagłówka "diff --git a/… b/…"
  const files = diff.split(/(?=^diff --git )/m).filter(Boolean);
  const kept = files.filter((hunk) => {
    const path = hunk.match(/^diff --git a\/(\S+)/m)?.[1] ?? "";
    return !NOISE.some((re) => re.test(path));
  });
  return { prunedDiff: kept.join(""), dropped: files.length - kept.length };
}

// Proces review na podstawie git diffa — z własnym narzędziem przycinającym szum
async function review(diff: string): Promise<Review> {
  const reviewer = new ToolLoopAgent({
    model: openrouter("z-ai/glm-5.1"),
    instructions: `${INSTRUCTIONS}\n\nNajpierw pobierz diff przez getReviewableDiff, recenzuj wyłącznie to, co zwróci.`,
    tools: {
      // narzędzie z trzech części: opis, schemat wejścia (zod) i execute
      getReviewableDiff: tool({
        description:
          "Zwróć diff do recenzji z odsianym szumem (lockfile'y, build, snapshoty). Wywołaj przed recenzją.",
        inputSchema: z.object({}), // bez argumentów — diff bierze z domknięcia
        execute: async () => pruneDiff(diff),
      }),
    },
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(4), // wywołanie narzędzia + recenzja + structured output
  });

  const { output } = await reviewer.generate({
    prompt: "Zrecenzuj zmiany z bieżącego diffa.",
  });
  return output;
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
