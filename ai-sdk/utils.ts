import { readFileSync } from "node:fs";
import { join } from "node:path";

// Wczytaj diff z pliku przykładowego: `npm run <skrypt> -- sample-2`
function loadSampleDiff(): string {
  const sample = process.argv[2] ?? "sample-1";
  const path = join(import.meta.dirname, "..", "data", `${sample}.md`);
  let diff = readFileSync(path, "utf8").trim();
  // sample-2 owija diff w blok ```diff — zdejmij ogrodzenie, jeśli jest
  if (diff.startsWith("```")) {
    diff = diff.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
  }
  return diff + "\n";
}

// Diff bierzemy ze stdin (git diff | …), a gdy nic nie podano — z pliku przykładowego
export async function readDiff(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const piped = Buffer.concat(chunks).toString("utf8").trim();
    if (piped) return piped + "\n";
  }
  return loadSampleDiff();
}
