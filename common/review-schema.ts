import { z } from "zod";

export const REVIEWER_PROMPT = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.`;

export const REVIEW_SCHEMA = z.object({
  correctness: z.number().int().min(1).max(5).describe("Poprawność: czy kod robi to, co deklaruje (1-5)"),
  security: z.number().int().min(1).max(5).describe("Bezpieczeństwo: podatności, walidacja wejścia, sekrety (1-5)"),
  performance: z.number().int().min(1).max(5).describe("Wydajność: złożoność, zbędne operacje, alokacje (1-5)"),
  readability: z.number().int().min(1).max(5).describe("Czytelność: nazwy, struktura, spójność ze stylem repo (1-5)"),
  testCoverage: z.number().int().min(1).max(5).describe("Pokrycie testami: czy zmiana ma adekwatne testy (1-5)"),
  comment: z.string().describe("Krótki komentarz (2-3 zdania) z najważniejszymi obserwacjami"),
});

export const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA, { target: "draft-07" });

export type Review = z.infer<typeof REVIEW_SCHEMA>;
