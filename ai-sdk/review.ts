import "dotenv/config";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  REVIEWER_PROMPT,
  ReviewResult,
} from "../common/review-schema";
import { readDiff } from "./utils";

async function review(diff: string): Promise<ReviewResult> {
  const reviewer = new ToolLoopAgent({
    model: openrouter("z-ai/glm-5.3"),
    instructions: REVIEWER_PROMPT,
    tools: {},
    output: Output.object({ schema: ReviewResult }),
    stopWhen: isStepCount(2),
  });

  const { output } = await reviewer.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
  });
  return output;
}

const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
