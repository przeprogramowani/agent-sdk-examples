import "dotenv/config";
import { ToolLoopAgent, isStepCount } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillPath = join(
  import.meta.dirname,
  "..",
  "anthropic",
  ".claude",
  "skills",
  "greeting",
  "SKILL.md",
);
const skill = readFileSync(skillPath, "utf8");

const agent = new ToolLoopAgent({
  model: openrouter("z-ai/glm-5.3"),
  instructions: `Stosuj poniższy skill dokładnie tak, jak go opisano:\n\n${skill}`,
  stopWhen: isStepCount(1),
});

const { text } = await agent.generate({ prompt: "Przywitaj się ze mną." });
console.log(text);
