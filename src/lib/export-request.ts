import { z } from "zod";
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from "./types";

export const MAX_PRINTABLE_CARDS = 120;

export const exportOptionsSchema = z.object({
  includeMain: z.boolean().default(DEFAULT_EXPORT_OPTIONS.includeMain),
  includeExtra: z.boolean().default(DEFAULT_EXPORT_OPTIONS.includeExtra),
  includeSide: z.boolean().default(DEFAULT_EXPORT_OPTIONS.includeSide),
  drawCutBorders: z.boolean().default(DEFAULT_EXPORT_OPTIONS.drawCutBorders),
});

export const deckInputSchema = z.object({
  input: z.string().trim().min(1, "Paste a YDKE link or upload a file first."),
});

export const exportRequestSchema = deckInputSchema.extend({
  options: exportOptionsSchema.default(DEFAULT_EXPORT_OPTIONS),
});

export type ExportRequest = {
  input: string;
  options: ExportOptions;
};
