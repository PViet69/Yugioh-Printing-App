import {
  AlignmentType,
  HeightRule,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  WidthType,
} from "docx";
import { chunkCards, PRINT_LAYOUT } from "./print-layout";
import type { CardInstance, MissingCard } from "./types";
import { fetchImageBytes, mapWithConcurrency } from "./ygoprodeck";

const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
const MARGIN_TWIPS = 284;
const GUTTER_TWIPS = 0;
const CARD_WIDTH_PX = 240;
const CARD_HEIGHT_PX = Math.round(CARD_WIDTH_PX * (614 / 421));
const TABLE_WIDTH_TWIPS = A4_WIDTH_TWIPS - MARGIN_TWIPS * 2;
const CELL_WIDTH_TWIPS = Math.floor(TABLE_WIDTH_TWIPS / PRINT_LAYOUT.columns);
const CELL_HEIGHT_TWIPS = Math.floor((A4_HEIGHT_TWIPS - MARGIN_TWIPS * 2) / PRINT_LAYOUT.rows);

export type DocxExportResult = {
  bytes: Uint8Array;
  missingCards: MissingCard[];
};

type DrawableDocxCard = {
  card: CardInstance;
  imageBytes: Uint8Array;
};

export async function generateDeckDocx(cards: CardInstance[]): Promise<DocxExportResult> {
  const preparedCards = await mapWithConcurrency(cards, 6, async (card) => {
    if (!card.card) {
      return {
        missingCard: toMissingCard(card, card.error ?? "Card was not found in YGOPRODeck."),
      };
    }

    try {
      const { bytes } = await fetchImageBytes(card.card.imageUrl);
      return {
        drawableCard: { card, imageBytes: bytes },
      };
    } catch (error) {
      return {
        missingCard: toMissingCard(
          card,
          error instanceof Error ? error.message : "Failed to download card image.",
        ),
      };
    }
  });
  const drawableCards = preparedCards.flatMap((result) =>
    result.drawableCard ? [result.drawableCard] : [],
  );
  const missingCards = preparedCards.flatMap((result) =>
    result.missingCard ? [result.missingCard] : [],
  );

  const pageChunks = chunkCards(drawableCards);
  const children: Array<Table | Paragraph> = [];

  for (const [pageIndex, pageCards] of pageChunks.entries()) {
    if (pageIndex > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(createPageTable(pageCards));
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: "No printable cards were resolved." }));
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIPS,
              height: A4_HEIGHT_TWIPS,
            },
            margin: {
              top: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
            },
          },
        },
        children,
      },
    ],
  });

  return {
    bytes: await Packer.toBuffer(document),
    missingCards,
  };
}

function createPageTable(cards: DrawableDocxCard[]): Table {
  const cells = Array.from({ length: PRINT_LAYOUT.cardsPerPage }, (_, index) =>
    createCardCell(cards[index]),
  );
  const rows = chunkCards(cells, PRINT_LAYOUT.columns).map(
    (rowCells) =>
      new TableRow({
        children: rowCells,
        cantSplit: true,
        height: {
          value: CELL_HEIGHT_TWIPS,
          rule: HeightRule.EXACT,
        },
      }),
  );

  return new Table({
    rows,
    layout: TableLayoutType.FIXED,
    width: {
      size: TABLE_WIDTH_TWIPS,
      type: WidthType.DXA,
    },
    margins: {
      top: GUTTER_TWIPS,
      bottom: GUTTER_TWIPS,
      left: GUTTER_TWIPS,
      right: GUTTER_TWIPS,
    },
    borders: hiddenTableBorders(),
  });
}

function createCardCell(printableCard: DrawableDocxCard | undefined): TableCell {
  const children: Paragraph[] = [];

  if (printableCard?.card.card) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: "jpg",
            data: printableCard.imageBytes,
            transformation: {
              width: CARD_WIDTH_PX,
              height: CARD_HEIGHT_PX,
            },
          }),
        ],
      }),
    );
  } else {
    children.push(new Paragraph({ text: "" }));
  }

  return new TableCell({
    width: {
      size: CELL_WIDTH_TWIPS,
      type: WidthType.DXA,
    },
    margins: {
      top: GUTTER_TWIPS,
      bottom: GUTTER_TWIPS,
      left: GUTTER_TWIPS,
      right: GUTTER_TWIPS,
    },
    borders: hiddenTableBorders(),
    children,
  });
}

function hiddenTableBorders() {
  const border = { style: "none" as const, size: 0, color: "FFFFFF" };

  return {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
}

function toMissingCard(card: CardInstance, reason: string): MissingCard {
  return {
    instanceId: card.instanceId,
    section: card.section,
    sectionIndex: card.sectionIndex,
    passcode: card.passcode,
    name: card.card?.name,
    reason,
  };
}
