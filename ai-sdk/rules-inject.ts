import { ToolLoopAgent, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Kontrast wobec anthropic/skill-autoload.ts: tam gotowy agent SAM odkrywa
// .claude/skills/greeting i stosuje go. Vercel AI SDK nie zna pojęcia skilli
// ani CLAUDE.md — żeby uzyskać ten sam efekt, sam wczytujesz plik z dysku
// i wstrzykujesz jego treść do `instructions`. Nic nie ładuje się „samo".
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
  model: openrouter("z-ai/glm-5.1"),
  // ręcznie wczytany skill staje się częścią promptu systemowego
  instructions: `Stosuj poniższy skill dokładnie tak, jak go opisano:\n\n${skill}`,
  stopWhen: stepCountIs(1),
});

// Ten sam prompt co w skill-autoload.ts — ale tu efekt bierze się z naszego
// ręcznego wstrzyknięcia, a nie z autoload'u harnessu.
const { text } = await agent.generate({ prompt: "Przywitaj się ze mną." });
console.log(text);
