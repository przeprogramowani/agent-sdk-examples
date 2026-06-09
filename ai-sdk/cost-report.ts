import { ToolLoopAgent, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Prosta operacja — dowolne wywołanie, którego koszt chcemy zmierzyć
const agent = new ToolLoopAgent({
  // `usage: { include: true }` włącza raportowanie zużycia po stronie OpenRoutera,
  // dzięki czemu w providerMetadata wraca realny, rozliczony koszt w USD
  model: openrouter("z-ai/glm-5.1", { usage: { include: true } }),
  instructions: "Jesteś zwięzły. Odpowiadaj jednym zdaniem.",
  stopWhen: stepCountIs(1),
});

// Zużycie na bieżąco: onStepFinish odpala się po każdej turze (numer kroku,
// tokeny, powód zakończenia) — telemetrię per krok składasz sam
const { text, totalUsage, providerMetadata } = await agent.generate({
  prompt: "Napisz jednozdaniowe powitanie dla zespołu programistów.",
  onStepFinish: ({ stepNumber, usage, finishReason }) => {
    console.error(
      `krok ${stepNumber}: ${usage.inputTokens} in / ${usage.outputTokens} out (${finishReason})`,
    );
  },
});

// Tokeny dostajesz wprost z wyniku (camelCase, w odróżnieniu od snake_case w Claude Agent SDK)
// Koszt w USD składasz sam — tu z pomocą providera: OpenRouter raportuje rozliczony koszt.
// Z providerem, który kosztu nie zwraca, zostaje pomnożenie tokenów przez stawki modelu.
const openrouterUsage = providerMetadata?.openrouter?.usage as
  | { cost?: number; totalTokens?: number }
  | undefined;

const report = {
  cost_usd: openrouterUsage?.cost ?? null, // realny koszt z OpenRoutera (null, jeśli provider nie raportuje)
  usage: {
    inputTokens: totalUsage.inputTokens,
    outputTokens: totalUsage.outputTokens,
    totalTokens: totalUsage.totalTokens,
  },
  model: "z-ai/glm-5.1",
};

const outPath = join(import.meta.dirname, "cost.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Odpowiedź: ${text}`);
console.log(`Koszt zapisany do: ${outPath}`);
