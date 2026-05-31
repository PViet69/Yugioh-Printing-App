import { PDFDocument } from "pdf-lib";
import { A4_PAGE, calculateCardPlacement, chunkCards } from "./print-layout";
import type { CardInstance, MissingCard } from "./types";
import { fetchImageBytes, mapWithConcurrency } from "./ygoprodeck";

export type PdfExportResult = {
  bytes: Uint8Array;
  missingCards: MissingCard[];
};

export async function generateDeckPdf(cards: CardInstance[]): Promise<PdfExportResult> {
  const preparedCards = await mapWithConcurrency(cards, 6, async (card) => {
    if (!card.card) {
      return {
        missingCard: toMissingCard(card, card.error ?? "Card was not found in YGOPRODeck."),
      };
    }

    try {
      const image = await fetchImageBytes(card.card.imageUrl);
      return {
        drawableCard: { card, imageBytes: image.bytes, contentType: image.contentType },
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

  const pdf = await PDFDocument.create();
  const pages = chunkCards(drawableCards);

  for (const [pageIndex, pageCards] of pages.entries()) {
    const page = pdf.addPage([A4_PAGE.width, A4_PAGE.height]);

    for (const [indexOnPage, printableCard] of pageCards.entries()) {
      const globalIndex = pageIndex * 9 + indexOnPage;
      const placement = calculateCardPlacement(globalIndex, pageIndex);
      const image = await embedImage(
        pdf,
        printableCard.imageBytes,
        printableCard.contentType,
        printableCard.card.card?.imageUrl ?? "",
      );

      page.drawImage(image, {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
      });
    }
  }

  if (pages.length === 0) {
    pdf.addPage([A4_PAGE.width, A4_PAGE.height]);
  }

  return {
    bytes: await pdf.save(),
    missingCards,
  };
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
