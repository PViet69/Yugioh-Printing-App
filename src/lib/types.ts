export type DeckSection = "main" | "extra" | "side";

export type ParsedYdkeDeck = {
  main: string[];
  extra: string[];
  side: string[];
  allIds: string[];
};

export type PrintFileInput = {
  id: string;
  name?: string;
  input: string;
};

export type ResolvedCard = {
  passcode: string;
  id: number;
  name: string;
  type?: string;
  frameType?: string;
  imageUrl: string;
  imageUrlSmall?: string;
  imageUrlCropped?: string;
  source?: "ygoprodeck" | "manual";
};

export type CardInstance = {
  instanceId: string;
  section: DeckSection;
  sectionIndex: number;
  passcode: string;
  card?: ResolvedCard;
  error?: string;
};

export type MissingCard = {
  instanceId: string;
  section: DeckSection;
  sectionIndex: number;
  passcode: string;
  name?: string;
  reason: string;
};

export type ManualCardReplacement = {
  instanceId: string;
  passcode: string;
  name: string;
  imageUrl: string;
};

export type DeckResolution = {
  parsed: ParsedYdkeDeck;
  cards: CardInstance[];
  unresolved: CardInstance[];
  counts: Record<DeckSection, number>;
};

export type ExportOptions = {
  includeMain: boolean;
  includeExtra: boolean;
  includeSide: boolean;
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeMain: true,
  includeExtra: true,
  includeSide: true,
};
