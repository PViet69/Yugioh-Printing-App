import type { CardInstance, DeckSection, ExportOptions } from "./types";

export const MM_TO_POINTS = 72 / 25.4;
export const A4_PAGE = {
  width: 595.28,
  height: 841.89,
};

export const CARD_ASPECT_RATIO = 421 / 614;

export const PRINT_LAYOUT = {
  columns: 3,
  rows: 3,
  cardsPerPage: 9,
  marginMm: 8,
  gutterMm: 2,
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
  const cellWidth = usableWidth / PRINT_LAYOUT.columns;
  const cellHeight = usableHeight / PRINT_LAYOUT.rows;
  const fitted = fitAspectRatio(cellWidth, cellHeight, CARD_ASPECT_RATIO);
  const cellX = margin + column * (cellWidth + gutter);
  const cellTopY = A4_PAGE.height - margin - row * (cellHeight + gutter);

  return {
    pageIndex,
    cardIndex,
    row,
    column,
    x: cellX + (cellWidth - fitted.width) / 2,
    y: cellTopY - cellHeight + (cellHeight - fitted.height) / 2,
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
