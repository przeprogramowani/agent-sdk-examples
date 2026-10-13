import "dotenv/config";
import { ToolLoopAgent, Output, isStepCount, type ModelMessage } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { REVIEWER_PROMPT, ReviewResult } from "../common/review-schema";
import { readDiff } from "./utils";

const structuredReviewer = new ToolLoopAgent({
  model: openrouter("z-ai/glm-5.3"),
  instructions: REVIEWER_PROMPT,
  output: Output.object({ schema: ReviewResult }),
  stopWhen: isStepCount(2),
});

const recaller = new ToolLoopAgent({
  model: openrouter("z-ai/glm-5.3"),
  instructions:
    "Jesteś tym samym recenzentem. Odpowiadaj zwięźle, zwykłym tekstem, korzystając z historii rozmowy.",
  stopWhen: isStepCount(1),
});

const diff = await readDiff();
const messages: ModelMessage[] = [
  { role: "user", content: `Zrecenzuj ten diff:\n\n${diff}` },
];

const first = await structuredReviewer.generate({ messages });
messages.push(...first.responseMessages);
console.error("[1] recenzja:");
console.log(JSON.stringify(first.output, null, 2));

messages.push({
  role: "user",
  content:
    "Bez ponownego wczytywania diffa: który plik recenzowałeś i które kryterium dostało najniższą ocenę? Odpowiedz krótko, zwykłym tekstem.",
});
const second = await recaller.generate({ messages });
console.error("\n[2] po doniesieniu historii (bez ponownego diffa):");
console.log(second.text);
