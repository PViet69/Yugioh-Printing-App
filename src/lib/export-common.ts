import { parseDeckInput } from "./deck-input";
import { MAX_PRINTABLE_CARDS } from "./export-request";
import { filterCardsForExport } from "./print-layout";
import type { CardInstance, ExportOptions } from "./types";
import { resolveDeck } from "./ygoprodeck";

export class ExportValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExportValidationError";
    this.status = status;
  }
}

export async function resolvePrintableCards(input: string, options: ExportOptions): Promise<CardInstance[]> {
  const parsed = parseDeckInput(input);

  if (parsed.allIds.length > MAX_PRINTABLE_CARDS) {
    throw new ExportValidationError(
      `This deck contains ${parsed.allIds.length} cards. The current limit is ${MAX_PRINTABLE_CARDS}.`,
      413,
    );
  }

  const resolution = await resolveDeck(parsed);
  const printableCards = filterCardsForExport(resolution.cards, options);

  if (printableCards.length === 0) {
    throw new ExportValidationError("Choose at least one deck section with cards to export.");
  }

  const unresolved = printableCards.filter((card) => !card.card);

  if (unresolved.length > 0) {
    throw new ExportValidationError(
      `Cannot export until all selected cards resolve. Missing: ${unresolved
        .map((card) => card.passcode)
        .join(", ")}.`,
      422,
    );
  }

  return printableCards;
}
