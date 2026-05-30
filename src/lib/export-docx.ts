import {
  AlignmentType,
  BorderStyle,
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
import type { CardInstance, ExportOptions } from "./types";
import { fetchImageBytes } from "./ygoprodeck";

const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
const MARGIN_TWIPS = 360;
const GUTTER_TWIPS = 90;
const CARD_WIDTH_PX = 240;
const CARD_HEIGHT_PX = Math.round(CARD_WIDTH_PX * (614 / 421));
const TABLE_WIDTH_TWIPS = A4_WIDTH_TWIPS - MARGIN_TWIPS * 2;
const CELL_WIDTH_TWIPS = Math.floor(TABLE_WIDTH_TWIPS / PRINT_LAYOUT.columns);

export async function generateDeckDocx(
  cards: CardInstance[],
  options: Pick<ExportOptions, "drawCutBorders">,
): Promise<Uint8Array> {
  const pageChunks = chunkCards(cards);
  const children: Array<Table | Paragraph> = [];

  for (const [pageIndex, pageCards] of pageChunks.entries()) {
    if (pageIndex > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(await createPageTable(pageCards, options));
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

  return Packer.toBuffer(document);
}

async function createPageTable(
  cards: CardInstance[],
  options: Pick<ExportOptions, "drawCutBorders">,
): Promise<Table> {
  const cells = await Promise.all(
    Array.from({ length: PRINT_LAYOUT.cardsPerPage }, async (_, index) =>
      createCardCell(cards[index], options),
    ),
  );
  const rows = chunkCards(cells, PRINT_LAYOUT.columns).map(
    (rowCells) =>
      new TableRow({
        children: rowCells,
        cantSplit: true,
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
    borders: tableBorders(options.drawCutBorders),
  });
}

async function createCardCell(
  card: CardInstance | undefined,
  options: Pick<ExportOptions, "drawCutBorders">,
): Promise<TableCell> {
  const children: Paragraph[] = [];

  if (card?.card) {
    const { bytes } = await fetchImageBytes(card.card.imageUrl);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: "jpg",
            data: bytes,
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
    borders: tableBorders(options.drawCutBorders),
    children,
  });
}

function tableBorders(enabled: boolean) {
  const border = enabled
    ? { style: BorderStyle.SINGLE, size: 2, color: "C7CBD1" }
    : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  return {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
}
