import type { ParsedYdkeDeck } from "./types";

const YDKE_PREFIX = "ydke://";
const YDKE_URL_PATTERN = /ydke:\/\/[^\s<>"]+/i;

export class YdkeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YdkeParseError";
  }
}

export function parseYdke(input: string): ParsedYdkeDeck {
  const ydkeUrl = extractYdkeUrl(input);
  const payload = ydkeUrl.slice(YDKE_PREFIX.length);
  const rawSections = payload.split("!");

  if (rawSections.length < 4) {
    throw new YdkeParseError(
      "YDKE links must include main, extra, and side sections separated by '!'.",
    );
  }

  const [mainPayload, extraPayload, sidePayload] = rawSections;
  const main = decodeSection(mainPayload, "main");
  const extra = decodeSection(extraPayload, "extra");
  const side = decodeSection(sidePayload, "side");

  return {
    main,
    extra,
    side,
    allIds: [...main, ...extra, ...side],
  };
}

export function extractYdkeUrl(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(YDKE_URL_PATTERN);

  if (!match) {
    throw new YdkeParseError("Paste a valid YDKE link that starts with ydke://.");
  }

  return trimTrailingPunctuation(match[0]);
}

export function buildYdkeFromSections(sections: {
  main?: number[];
  extra?: number[];
  side?: number[];
}): string {
  const main = encodeSection(sections.main ?? []);
  const extra = encodeSection(sections.extra ?? []);
  const side = encodeSection(sections.side ?? []);

  return `${YDKE_PREFIX}${main}!${extra}!${side}!`;
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[),.;]+$/g, "");
}

function decodeSection(payload: string, sectionName: string): string[] {
  if (!payload) {
    return [];
  }

  let bytes: Uint8Array;

  try {
    bytes = decodeBase64(payload);
  } catch {
    throw new YdkeParseError(`The ${sectionName} section is not valid base64.`);
  }

  if (bytes.byteLength % 4 !== 0) {
    throw new YdkeParseError(
      `The ${sectionName} section has invalid card data. Its decoded byte length must be divisible by 4.`,
    );
  }

  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ids: string[] = [];

  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    ids.push(String(dataView.getUint32(offset, true)));
  }

  return ids;
}

function decodeBase64(payload: string): Uint8Array {
  const normalized = normalizeBase64(payload);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function normalizeBase64(payload: string): string {
  const withoutWhitespace = payload.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (withoutWhitespace.length % 4)) % 4;
  return `${withoutWhitespace}${"=".repeat(paddingLength)}`;
}

function encodeSection(ids: number[]): string {
  const bytes = new Uint8Array(ids.length * 4);
  const dataView = new DataView(bytes.buffer);

  ids.forEach((id, index) => {
    dataView.setUint32(index * 4, id, true);
  });

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/=+$/g, "");
}
