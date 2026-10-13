"""Claude Agent SDK (Python) — recenzja kodu ze strukturalnym wyjściem,
z możliwością podmiany modelu i przekierowania na OpenRouter.

To Pythonowy odpowiednik `anthropic/review.ts`. Pokazuje dwie dźwignie
sterowania modelem w Claude Agent SDK:

  1. `model=` w ClaudeAgentOptions — wprost wskazuje model.
  2. `env=` — SDK uruchamia CLI `claude` jako podproces, więc dziedziczy
     wszystkie zmienne środowiskowe Claude Code. Ustawiając ANTHROPIC_BASE_URL
     + ANTHROPIC_AUTH_TOKEN kierujemy agenta na OpenRouter, a tier-zmienne
     (ANTHROPIC_DEFAULT_SONNET_MODEL) mapują "tier" na slug modelu OpenRoutera.

Wybór dostawcy: jeśli w środowisku jest OPENROUTER_API_KEY, jedziemy przez
OpenRouter; w przeciwnym razie wprost przez Anthropic (lokalny login `claude`
albo ANTHROPIC_API_KEY).

Uwaga: przez OpenRouter najpewniej działają modele Anthropica. Dla modeli
nie-Anthropic część funkcji może nie działać (tool use bywa nieobsługiwany,
extended thinking działa tylko na modelach Claude).
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    ResultMessage,
    AssistantMessage,
    TextBlock,
)

from review_schema import REVIEW_JSON_SCHEMA, REVIEWER_PROMPT, ReviewResult
from utils import read_diff

# REVIEW_DEBUG=1 => wypisuje surowe komunikaty agenta i stderr CLI.
DEBUG = os.environ.get("REVIEW_DEBUG") == "1"

# Sterowanie skryptem przez pliki .env. Oba ładowane bez override, a przy
# override=False wygrywa pierwsza ustawiona wartość — stąd kolejność dająca
# pierwszeństwo: zmienne powłoki > lokalny anthropic-python/.env > root repo.
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")


def _openrouter_key() -> str | None:
    return os.environ.get("OPENROUTER_API_KEY") or None


# max_turns liczy tylko tury z użyciem narzędzi, a structured output dolicza tury
# przy ponawianiu na błąd walidacji. Za ciasny limit (np. 2) potrafi wyczerpać
# się, zanim padnie poprawny wynik — dajemy zapas i pozwalamy nadpisać z env.
MAX_TURNS = int(os.environ.get("MAX_TURNS", "8"))


def build_options() -> ClaudeAgentOptions:
    common = dict(
        system_prompt=REVIEWER_PROMPT,
        # tools=[] => --tools "" — wyłącza domyślne narzędzia Claude Code.
        # Czysta recenzja: bez tego agent próbuje eksplorować repo i zużywa tury.
        tools=[],
        max_turns=MAX_TURNS,
        output_format={"type": "json_schema", "schema": REVIEW_JSON_SCHEMA},
    )
    if DEBUG:
        # Podgląd stderr podprocesu CLI (ostrzeżenia o structured output itp.).
        common["stderr"] = lambda line: print(f"[cli] {line}", file=sys.stderr)

    # OpenRouter, gdy ustawiony OPENROUTER_API_KEY; inaczej wprost Anthropic.
    # By wymusić Anthropica mimo klucza w głównym .env: wyzeruj go w lokalnym
    # anthropic-python/.env (OPENROUTER_API_KEY=) albo `env -u OPENROUTER_API_KEY ...`.
    openrouter_key = _openrouter_key()
    if openrouter_key:
        model = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-5.5")
        return ClaudeAgentOptions(
            model=model,
            env={
                "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
                "ANTHROPIC_AUTH_TOKEN": openrouter_key,
                "ANTHROPIC_API_KEY": "",  # musi być jawnie puste
                # Tier-override: gdy CLI rozwiązuje "tier sonnet", dostaje ten slug.
                "ANTHROPIC_DEFAULT_SONNET_MODEL": model,
            },
            **common,
        )

    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
    return ClaudeAgentOptions(model=model, **common)


def _hint(err: str) -> str:
    """Podpowiedź naprawcza dla typowych błędów structured output."""
    if "maximum number of turns" in err or "structured_output_retries" in err:
        where = "OpenRouter" if _openrouter_key() else "Anthropic"
        return (
            f" [ścieżka: {where}] Agent nie zdążył wyprodukować wyniku zgodnego ze schemą "
            f"w limicie tur. Zwiększ MAX_TURNS; jeśli przez OpenRouter to nie pomaga, "
            f"możliwe, że ten endpoint nie przekazuje output_format — sprawdź wprost na Anthropic."
        )
    return ""


async def review(diff: str) -> ReviewResult:
    options = build_options()
    result_message: ResultMessage | None = None

    try:
        async for message in query(prompt=f"Zrecenzuj ten diff:\n\n{diff}", options=options):
            if DEBUG:
                print(f"[msg] {type(message).__name__}", file=sys.stderr)
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            print(f"[text] {block.text[:500]}", file=sys.stderr)
            if isinstance(message, ResultMessage):
                result_message = message
    except Exception as exc:  # SDK rzuca wyjątek m.in. przy error_max_turns
        raise RuntimeError(f"Review nie powiodło się: {exc}{_hint(str(exc))}") from exc

    if result_message is None:
        raise RuntimeError("Agent nie zwrócił wyniku")
    if result_message.is_error:
        errs = "; ".join(result_message.errors or []) or result_message.subtype
        raise RuntimeError(f"Review nie powiodło się: {errs}{_hint(errs)}")
    if result_message.structured_output is None:
        raise RuntimeError("Brak structured output w wyniku")

    return ReviewResult.model_validate(result_message.structured_output)


async def main() -> None:
    diff = read_diff()
    result = await review(diff)
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
