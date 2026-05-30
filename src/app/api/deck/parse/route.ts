import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseDeckInput } from "@/lib/deck-input";
import { deckInputSchema, MAX_PRINTABLE_CARDS } from "@/lib/export-request";
import { YdkeParseError } from "@/lib/ydke";
import { CardResolutionError, resolveDeck } from "@/lib/ygoprodeck";

export async function POST(request: Request) {
  try {
    const body = deckInputSchema.parse(await request.json());
    const parsed = parseDeckInput(body.input);

    if (parsed.allIds.length > MAX_PRINTABLE_CARDS) {
      return NextResponse.json(
        {
          error: `This deck contains ${parsed.allIds.length} cards. The current limit is ${MAX_PRINTABLE_CARDS}.`,
        },
        { status: 413 },
      );
    }

    const resolution = await resolveDeck(parsed);
    return NextResponse.json(resolution);
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  if (error instanceof YdkeParseError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CardResolutionError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  console.error(error);
  return NextResponse.json({ error: "Unable to parse this deck." }, { status: 500 });
}
