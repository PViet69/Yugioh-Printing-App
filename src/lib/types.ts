export type DeckSection = "main" | "extra" | "side";

export type ParsedYdkeDeck = {
  main: string[];
  extra: string[];
  side: string[];
  allIds: string[];
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
};

export type CardInstance = {
  instanceId: string;
  section: DeckSection;
  sectionIndex: number;
  passcode: string;
  card?: ResolvedCard;
  error?: string;
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
  drawCutBorders: boolean;
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeMain: true,
  includeExtra: true,
  includeSide: false,
  drawCutBorders: false,
};
