import "dotenv/config";
import { ToolLoopAgent, isStepCount } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const agent = new ToolLoopAgent({
  model: openrouter("z-ai/glm-5.1", { usage: { include: true } }),
  instructions: "Jesteś zwięzły. Odpowiadaj jednym zdaniem.",
  stopWhen: isStepCount(1),
});

const { text, usage, steps } = await agent.generate({
  prompt: "Napisz jednozdaniowe powitanie dla zespołu programistów.",
  onStepEnd: ({ stepNumber, usage: stepUsage, finishReason }) => {
    console.error(
      `krok ${stepNumber}: ${stepUsage.inputTokens} in / ${stepUsage.outputTokens} out (${finishReason})`,
    );
  },
});

// `usage` sumuje tokeny ze wszystkich kroków, ale top-level `providerMetadata`
// dotyczy tylko ostatniego kroku — koszt OpenRouter sumujemy więc po `steps`.
const costUsd = steps.reduce(
  (sum, step) =>
    sum +
    ((step.providerMetadata?.openrouter?.usage as { cost?: number } | undefined)
      ?.cost ?? 0),
  0,
);

const report = {
  cost_usd: costUsd,
  usage: {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  },
  model: "z-ai/glm-5.1",
};

const outPath = join(import.meta.dirname, "cost.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Odpowiedź: ${text}`);
console.log(`Koszt zapisany do: ${outPath}`);
