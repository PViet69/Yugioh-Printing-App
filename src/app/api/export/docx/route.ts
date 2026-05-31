import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ExportValidationError, resolvePrintableCardsFromRequest } from "@/lib/export-common";
import { exportRequestSchema } from "@/lib/export-request";
import { MISSING_CARDS_HEADER, serializeMissingCards } from "@/lib/export-result";
import { generateDeckDocx } from "@/lib/export-docx";
import { YdkeParseError } from "@/lib/ydke";
import { CardResolutionError } from "@/lib/ygoprodeck";

export async function POST(request: Request) {
  try {
    const body = exportRequestSchema.parse(await request.json());
    const cards = await resolvePrintableCardsFromRequest(body, body.options, body.manualCards);
    const docx = await generateDeckDocx(cards);

    return new Response(new Uint8Array(docx.bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="deck-print.docx"',
        [MISSING_CARDS_HEADER]: serializeMissingCards(docx.missingCards),
      },
    });
  } catch (error) {
    return handleExportError(error);
  }
}

function handleExportError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  if (error instanceof ExportValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof YdkeParseError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CardResolutionError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  console.error(error);
  return NextResponse.json({ error: "Unable to generate the Word document." }, { status: 500 });
}
