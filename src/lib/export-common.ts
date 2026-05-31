import { parseDeckInput } from "./deck-input";
import { MAX_PRINTABLE_CARDS, normalizePrintInputs, type DeckInputRequest } from "./export-request";
import { filterCardsForExport } from "./print-layout";
import type {
  CardInstance,
  DeckResolution,
  ExportOptions,
  ManualCardReplacement,
  ParsedYdkeDeck,
  PrintFileInput,
} from "./types";
import { resolveDeck } from "./ygoprodeck";

export class ExportValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExportValidationError";
    this.status = status;
  }
}

export async function resolveDeckFromRequest(body: DeckInputRequest): Promise<DeckResolution> {
  return resolveDeckFromInputs(normalizePrintInputs(body));
}

export async function resolveDeckFromInputs(inputs: PrintFileInput[]): Promise<DeckResolution> {
  const parsedInputs = inputs.map((file) => ({ file, parsed: parseDeckInput(file.input) }));
  const totalCards = parsedInputs.reduce((total, current) => total + current.parsed.allIds.length, 0);

  if (totalCards > MAX_PRINTABLE_CARDS) {
    throw new ExportValidationError(
      `These files contain ${totalCards} cards. The current limit is ${MAX_PRINTABLE_CARDS}.`,
      413,
    );
  }

  const resolutions = await Promise.all(
    parsedInputs.map(async ({ file, parsed }) => ({
      file,
      parsed,
      resolution: await resolveDeck(parsed),
    })),
  );
  const cards = resolutions.flatMap(({ file, resolution }) =>
    resolution.cards.map((card) => prefixCardInstanceId(card, file.id)),
  );
  const parsed = combineParsedDecks(resolutions.map((item) => item.parsed));

  return {
    parsed,
    cards,
    unresolved: cards.filter((card) => !card.card),
    counts: {
      main: parsed.main.length,
      extra: parsed.extra.length,
      side: parsed.side.length,
    },
  };
}

export async function resolvePrintableCards(
  input: string,
  options: ExportOptions,
  manualCards: ManualCardReplacement[] = [],
): Promise<CardInstance[]> {
  return resolvePrintableCardsFromRequest({ input }, options, manualCards);
}

export async function resolvePrintableCardsFromRequest(
  body: DeckInputRequest,
  options: ExportOptions,
  manualCards: ManualCardReplacement[] = [],
): Promise<CardInstance[]> {
  const resolution = await resolveDeckFromRequest(body);
  const cards = applyManualCards(resolution.cards, manualCards);
  const printableCards = filterCardsForExport(cards, options);

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

export function applyManualCards(
  cards: CardInstance[],
  manualCards: ManualCardReplacement[],
): CardInstance[] {
  const manualByInstanceId = new Map(manualCards.map((card) => [card.instanceId, card]));

  return cards.map((card) => {
    const manualCard = manualByInstanceId.get(card.instanceId);

    if (!manualCard || manualCard.passcode !== card.passcode) {
      return card;
    }

    return {
      ...card,
      card: {
        passcode: card.passcode,
        id: Number(card.passcode) || 0,
        name: manualCard.name,
        imageUrl: manualCard.imageUrl,
        imageUrlSmall: manualCard.imageUrl,
        source: "manual",
      },
      error: undefined,
    };
  });
}

function prefixCardInstanceId(card: CardInstance, fileId: string): CardInstance {
  return {
    ...card,
    instanceId: `${fileId}:${card.instanceId}`,
  };
}

function combineParsedDecks(parsedDecks: ParsedYdkeDeck[]): ParsedYdkeDeck {
  const main = parsedDecks.flatMap((deck) => deck.main);
  const extra = parsedDecks.flatMap((deck) => deck.extra);
  const side = parsedDecks.flatMap((deck) => deck.side);

  return {
    main,
    extra,
    side,
    allIds: [...main, ...extra, ...side],
  };
}
