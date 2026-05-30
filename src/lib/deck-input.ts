import type { ParsedYdkeDeck, DeckSection } from "./types";
import { parseYdke, YdkeParseError } from "./ydke";

export function parseDeckInput(input: string): ParsedYdkeDeck {
  if (/ydke:\/\//i.test(input)) {
    return parseYdke(input);
  }

  return parseYdkText(input);
}

export function parseYdkText(input: string): ParsedYdkeDeck {
  const sections: Record<DeckSection, string[]> = {
    main: [],
    extra: [],
    side: [],
  };
  let activeSection: DeckSection | null = null;

  for (const rawLine of input.split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line === "#main") {
      activeSection = "main";
      continue;
    }

    if (line === "#extra") {
      activeSection = "extra";
      continue;
    }

    if (line === "!side") {
      activeSection = "side";
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (/^\d+$/.test(line)) {
      const section = activeSection ?? "main";
      sections[section].push(line);
    }
  }

  const allIds = [...sections.main, ...sections.extra, ...sections.side];

  if (allIds.length === 0) {
    throw new YdkeParseError("Paste a valid YDKE link or upload a .ydk file with card IDs.");
  }

  return {
    main: sections.main,
    extra: sections.extra,
    side: sections.side,
    allIds,
  };
}
