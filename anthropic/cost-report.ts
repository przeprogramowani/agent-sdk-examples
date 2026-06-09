import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Prosty query — dowolna operacja, której koszt chcemy zmierzyć
const result = query({
  prompt: "Napisz jednozdaniowe powitanie dla zespołu programistów.",
  options: {
    systemPrompt: "Jesteś zwięzły. Odpowiadaj jednym zdaniem.",
    model: "claude-sonnet-4-6",
    tools: [],
    maxTurns: 1,
  },
});

for await (const message of result) {
  if (message.type !== "result") continue;
  if (message.subtype !== "success") {
    throw new Error(`Operacja nie powiodła się (${message.subtype})`);
  }

  // Komplet metryk kosztowych prosto z wiadomości `result`
  const report = {
    total_cost_usd: message.total_cost_usd, // gotowy koszt w USD — SDK liczy za ciebie
    num_turns: message.num_turns,
    duration_ms: message.duration_ms,
    usage: {
      // uwaga: `usage` ma pola snake_case (z API), z rozbiciem na cache
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
    },
    modelUsage: message.modelUsage, // rozbicie per model (camelCase: inputTokens, costUSD…)
  };

  const outPath = join(import.meta.dirname, "cost.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Odpowiedź: ${message.result}`);
  console.log(`Koszt zapisany do: ${outPath}`);
}
