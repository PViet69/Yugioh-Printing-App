import { z } from "zod";
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type ManualCardReplacement,
  type PrintFileInput,
} from "./types";

export const MAX_PRINTABLE_CARDS = 360;

export const exportOptionsSchema = z.object({
  includeMain: z.boolean().default(DEFAULT_EXPORT_OPTIONS.includeMain),
  includeExtra: z.boolean().default(DEFAULT_EXPORT_OPTIONS.includeExtra),
  includeSide: z.boolean().default(DEFAULT_EXPORT_OPTIONS.includeSide),
});

export const printFileInputSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().optional(),
  input: z.string().trim(),
});

export const deckInputSchema = z.object({
  input: z.string().trim().optional(),
  inputs: z.array(printFileInputSchema).optional(),
});

export const manualCardReplacementSchema = z.object({
  instanceId: z.string().trim().min(1),
  passcode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  imageUrl: z.string().trim().refine(
    (value) => value.startsWith("data:image/") || z.string().url().safeParse(value).success,
    "Upload a valid card image.",
  ),
});

export const exportRequestSchema = deckInputSchema.extend({
  options: exportOptionsSchema.default(DEFAULT_EXPORT_OPTIONS),
  manualCards: z.array(manualCardReplacementSchema).default([]),
});

export type DeckInputRequest = {
  input?: string;
  inputs?: PrintFileInput[];
};

export type ExportRequest = DeckInputRequest & {
  options: ExportOptions;
  manualCards: ManualCardReplacement[];
};

export function normalizePrintInputs(body: DeckInputRequest): PrintFileInput[] {
  const inputs = body.inputs?.length
    ? body.inputs
    : [
        {
          id: "single",
          name: "Deck 1",
          input: body.input ?? "",
        },
      ];

  const normalizedInputs = inputs
    .map((file, index) => ({
      id: file.id.trim() || `file-${index + 1}`,
      name: file.name?.trim() || `Deck ${index + 1}`,
      input: file.input.trim(),
    }))
    .filter((file) => file.input.length > 0);

  if (normalizedInputs.length === 0) {
    throw new Error("Paste a YDKE link or upload a file first.");
  }

  return normalizedInputs;
}
