import type { CardInstance, DeckResolution, DeckSection, ParsedYdkeDeck, ResolvedCard } from "./types";

const API_BASE_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const CARD_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;
const MAX_CONCURRENT_REQUESTS = 6;

type YgoproDeckCardImage = {
  id: number;
  image_url: string;
  image_url_small?: string;
  image_url_cropped?: string;
};

type YgoproDeckCard = {
  id: number;
  name: string;
  type?: string;
  frameType?: string;
  card_images?: YgoproDeckCardImage[];
};

type YgoproDeckResponse = {
  data?: YgoproDeckCard[];
};

export class CardResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardResolutionError";
  }
}

export async function resolveCards(ids: string[]): Promise<Map<string, ResolvedCard>> {
  const uniqueIds = [...new Set(ids)];
  const entries = await mapWithConcurrency(uniqueIds, MAX_CONCURRENT_REQUESTS, async (id) => {
    try {
      const card = await fetchCardById(id);
      return [id, card] as const;
    } catch (error) {
      console.warn(
        error instanceof Error
          ? `Skipping card ${id}: ${error.message}`
          : `Skipping card ${id}: unknown YGOPRODeck error`,
      );
      return [id, undefined] as const;
    }
  });

  return new Map(entries.filter((entry): entry is readonly [string, ResolvedCard] => Boolean(entry[1])));
}

export async function resolveDeck(parsed: ParsedYdkeDeck): Promise<DeckResolution> {
  const resolvedCards = await resolveCards(parsed.allIds);
  const cards: CardInstance[] = [
    ...createCardInstances("main", parsed.main, resolvedCards),
    ...createCardInstances("extra", parsed.extra, resolvedCards),
    ...createCardInstances("side", parsed.side, resolvedCards),
  ];
  const unresolved = cards.filter((card) => !card.card);

  return {
    parsed,
    cards,
    unresolved,
    counts: {
      main: parsed.main.length,
      extra: parsed.extra.length,
      side: parsed.side.length,
    },
  };
}

export { mapWithConcurrency };

export async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (url.startsWith("data:image/")) {
    return decodeDataImage(url);
  }

  const response = await fetch(url, {
    next: { revalidate: CARD_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new CardResolutionError(`Failed to download image from ${url}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await response.arrayBuffer());

  return { bytes, contentType };
}

function decodeDataImage(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new CardResolutionError("Manual card image data is invalid.");
  }

  const [, contentType, base64Data] = match;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { bytes, contentType };
}

function createCardInstances(
  section: DeckSection,
  passcodes: string[],
  resolvedCards: Map<string, ResolvedCard>,
): CardInstance[] {
  return passcodes.map((passcode, sectionIndex) => {
    const card = resolvedCards.get(passcode);

    return {
      instanceId: `${section}-${sectionIndex}-${passcode}`,
      section,
      sectionIndex,
      passcode,
      card,
      error: card ? undefined : `Card ${passcode} was not found in YGOPRODeck.`,
    };
  });
}

async function fetchCardById(id: string): Promise<ResolvedCard | undefined> {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("id", id);

  const response = await fetch(url, {
    next: { revalidate: CARD_REVALIDATE_SECONDS },
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new CardResolutionError(`YGOPRODeck returned ${response.status} for card ${id}.`);
  }

  const payload = (await response.json()) as YgoproDeckResponse;
  const card = payload.data?.[0];
  const image = card?.card_images?.[0];

  if (!card || !image?.image_url) {
    return undefined;
  }

  return {
    passcode: id,
    id: card.id,
    name: card.name,
    type: card.type,
    frameType: card.frameType,
    imageUrl: image.image_url,
    imageUrlSmall: image.image_url_small,
    imageUrlCropped: image.image_url_cropped,
    source: "ygoprodeck",
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}
