import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ExportValidationError, resolvePrintableCards } from "@/lib/export-common";
import { exportRequestSchema } from "@/lib/export-request";
import { generateDeckPdf } from "@/lib/export-pdf";
import { YdkeParseError } from "@/lib/ydke";
import { CardResolutionError } from "@/lib/ygoprodeck";

export async function POST(request: Request) {
  try {
    const body = exportRequestSchema.parse(await request.json());
    const cards = await resolvePrintableCards(body.input, body.options);
    const pdf = await generateDeckPdf(cards, body.options);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="deck-print.pdf"',
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
  return NextResponse.json({ error: "Unable to generate the PDF." }, { status: 500 });
}
