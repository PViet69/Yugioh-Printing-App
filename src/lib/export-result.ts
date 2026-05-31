import type { MissingCard } from "./types";

export const MISSING_CARDS_HEADER = "X-Missing-Cards";

export type ExportResult = {
  bytes: Uint8Array;
  missingCards: MissingCard[];
};

export function missingCardLabel(card: MissingCard): string {
  const displayName = card.name ? `${card.name} (${card.passcode})` : card.passcode;
  return `${displayName}: ${card.reason}`;
}

export function serializeMissingCards(missingCards: MissingCard[]): string {
  return encodeURIComponent(JSON.stringify(missingCards));
}
