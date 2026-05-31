import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ExportValidationError, resolveDeckFromRequest } from "@/lib/export-common";
import { deckInputSchema } from "@/lib/export-request";
import { YdkeParseError } from "@/lib/ydke";
import { CardResolutionError } from "@/lib/ygoprodeck";

export async function POST(request: Request) {
  try {
    const body = deckInputSchema.parse(await request.json());
    const resolution = await resolveDeckFromRequest(body);
    return NextResponse.json(resolution);
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown) {
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

  if (error instanceof Error && error.message === "Paste a YDKE link or upload a file first.") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error(error);
  return NextResponse.json({ error: "Unable to parse this deck." }, { status: 500 });
}
