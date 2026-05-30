import { PDFDocument, rgb } from "pdf-lib";
import { A4_PAGE, calculateCardPlacement, chunkCards } from "./print-layout";
import type { CardInstance, ExportOptions } from "./types";
import { fetchImageBytes } from "./ygoprodeck";

export async function generateDeckPdf(
  cards: CardInstance[],
  options: Pick<ExportOptions, "drawCutBorders">,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pages = chunkCards(cards);

  for (const [pageIndex, pageCards] of pages.entries()) {
    const page = pdf.addPage([A4_PAGE.width, A4_PAGE.height]);

    for (const [indexOnPage, card] of pageCards.entries()) {
      if (!card.card) continue;

      const globalIndex = pageIndex * 9 + indexOnPage;
      const placement = calculateCardPlacement(globalIndex, pageIndex);
      const { bytes, contentType } = await fetchImageBytes(card.card.imageUrl);
      const image = await embedImage(pdf, bytes, contentType, card.card.imageUrl);

      page.drawImage(image, {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
      });

      if (options.drawCutBorders) {
        page.drawRectangle({
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          borderColor: rgb(0.75, 0.75, 0.75),
          borderWidth: 0.5,
        });
      }
    }
  }

  return pdf.save();
}

async function embedImage(
  pdf: PDFDocument,
  bytes: Uint8Array,
  contentType: string,
  url: string,
) {
  const lowerUrl = url.toLowerCase();
  const isPng = contentType.includes("png") || lowerUrl.endsWith(".png");

  if (isPng) {
    return pdf.embedPng(bytes);
  }

  return pdf.embedJpg(bytes);
}
