import type { CardInstance, DeckSection, ExportOptions } from "./types";

export const MM_TO_POINTS = 72 / 25.4;
export const A4_PAGE = {
  width: 595.28,
  height: 841.89,
};

export const CARD_ASPECT_RATIO = 59 / 86;

// Default physical card size (mm). Use these to compute exact card placement.
export const CARD_WIDTH_MM = 60;
export const CARD_HEIGHT_MM = 87;

export const PRINT_LAYOUT = {
  columns: 3,
  rows: 3,
  cardsPerPage: 9,
  marginMm: 5,
  gutterMm: 0,
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CardPlacement = Rect & {
  cardIndex: number;
  pageIndex: number;
  row: number;
  column: number;
};

export function mmToPoints(value: number): number {
  return value * MM_TO_POINTS;
}

export function chunkCards<T>(cards: T[], chunkSize = PRINT_LAYOUT.cardsPerPage): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < cards.length; index += chunkSize) {
    chunks.push(cards.slice(index, index + chunkSize));
  }

  return chunks;
}

export function filterCardsForExport(
  cards: CardInstance[],
  options: ExportOptions,
): CardInstance[] {
  const includedSections = new Set<DeckSection>();

  if (options.includeMain) includedSections.add("main");
  if (options.includeExtra) includedSections.add("extra");
  if (options.includeSide) includedSections.add("side");

  return cards.filter((card) => includedSections.has(card.section));
}

export function calculateCardPlacement(
  cardIndex: number,
  pageIndex = Math.floor(cardIndex / PRINT_LAYOUT.cardsPerPage),
): CardPlacement {
  const indexOnPage = cardIndex % PRINT_LAYOUT.cardsPerPage;
  const row = Math.floor(indexOnPage / PRINT_LAYOUT.columns);
  const column = indexOnPage % PRINT_LAYOUT.columns;
  const margin = mmToPoints(PRINT_LAYOUT.marginMm);
  const gutter = mmToPoints(PRINT_LAYOUT.gutterMm);
  const usableWidth = A4_PAGE.width - margin * 2 - gutter * (PRINT_LAYOUT.columns - 1);
  const usableHeight = A4_PAGE.height - margin * 2 - gutter * (PRINT_LAYOUT.rows - 1);
  const maxCardWidth = usableWidth / PRINT_LAYOUT.columns;
  const maxCardHeight = usableHeight / PRINT_LAYOUT.rows;

  // Preferred fixed card size in points (converted from mm).
  const preferredWidth = mmToPoints(CARD_WIDTH_MM);
  const preferredHeight = mmToPoints(CARD_HEIGHT_MM);

  // If preferred size fits within the grid cell, use it. Otherwise scale down
  // proportionally to fit within maxCardWidth/maxCardHeight.
  let fitted = { width: preferredWidth, height: preferredHeight };

  if (preferredWidth > maxCardWidth || preferredHeight > maxCardHeight) {
    const scale = Math.min(maxCardWidth / preferredWidth, maxCardHeight / preferredHeight);
    fitted = { width: preferredWidth * scale, height: preferredHeight * scale };
  }
  const gridWidth = fitted.width * PRINT_LAYOUT.columns + gutter * (PRINT_LAYOUT.columns - 1);
  const gridHeight = fitted.height * PRINT_LAYOUT.rows + gutter * (PRINT_LAYOUT.rows - 1);
  const gridX = margin + (usableWidth - gridWidth) / 2;
  const gridTopY = A4_PAGE.height - margin - (usableHeight - gridHeight) / 2;

  return {
    pageIndex,
    cardIndex,
    row,
    column,
    x: gridX + column * (fitted.width + gutter),
    y: gridTopY - (row + 1) * fitted.height - row * gutter,
    width: fitted.width,
    height: fitted.height,
  };
}

export function fitAspectRatio(
  maxWidth: number,
  maxHeight: number,
  aspectRatio: number,
): Pick<Rect, "width" | "height"> {
  const heightFromWidth = maxWidth / aspectRatio;

  if (heightFromWidth <= maxHeight) {
    return {
      width: maxWidth,
      height: heightFromWidth,
    };
  }

  return {
    width: maxHeight * aspectRatio,
    height: maxHeight,
  };
}
