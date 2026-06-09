import { query } from "@anthropic-ai/claude-agent-sdk";

// Dowód na autoload skilli: NIE podajemy treści powitania w promptcie.
// Agent ma sam odkryć .claude/skills/greeting/SKILL.md i zastosować jego treść.
const result = query({
  prompt: "Przywitaj się ze mną.",
  options: {
    systemPrompt: { type: "preset", preset: "claude_code" }, // tryb Claude Code
    settingSources: ["project"], // wczytaj .claude/ z projektu (tu: skille)
    skills: "all", // udostępnij modelowi wszystkie odkryte skille
    cwd: import.meta.dirname, // katalog 'anthropic', gdzie leży .claude/skills
  },
});

for await (const message of result) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
