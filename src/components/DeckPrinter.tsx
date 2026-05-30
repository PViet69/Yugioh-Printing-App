"use client";

import { useMemo, useState } from "react";
import { DEFAULT_EXPORT_OPTIONS, type DeckResolution, type ExportOptions } from "@/lib/types";

type ExportFormat = "pdf" | "docx";

export function DeckPrinter() {
  const [input, setInput] = useState("");
  const [resolution, setResolution] = useState<DeckResolution | null>(null);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const printableCount = useMemo(() => {
    if (!resolution) return 0;

    return resolution.cards.filter((card) => {
      if (card.section === "main") return options.includeMain;
      if (card.section === "extra") return options.includeExtra;
      return options.includeSide;
    }).length;
  }, [options, resolution]);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setInput(await file.text());
    setResolution(null);
    setError(null);
  }

  async function parseDeck() {
    setIsParsing(true);
    setError(null);
    setResolution(null);

    try {
      const response = await fetch("/api/deck/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to parse this deck.");
      }

      setResolution(payload as DeckResolution);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to parse this deck.");
    } finally {
      setIsParsing(false);
    }
  }

  async function exportDeck(format: ExportFormat) {
    setExportingFormat(format);
    setError(null);

    try {
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, options }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Export failed." }));
        throw new Error(payload.error ?? "Export failed.");
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = format === "pdf" ? "deck-print.pdf" : "deck-print.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Export failed.");
    } finally {
      setExportingFormat(null);
    }
  }

  const canExport = Boolean(resolution) && printableCount > 0 && resolution?.unresolved.length === 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-300">
          YDKE to print sheets
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
          Print Yu-Gi-Oh decks 9 cards per page.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Upload or paste a YDKE deck link, preview the resolved YGOPRODeck card images,
          then download print-ready PDF or Word files.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-slate-200" htmlFor="ydke-input">
              Paste YDKE link or file contents
            </label>
            <textarea
              id="ydke-input"
              className="min-h-48 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100 outline-none transition focus:border-yellow-300"
              placeholder="ydke://...!...!...!"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setResolution(null);
              }}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="cursor-pointer rounded-xl border border-dashed border-slate-600 px-4 py-3 text-sm text-slate-300 transition hover:border-yellow-300 hover:text-yellow-200">
              <input
                className="sr-only"
                type="file"
                accept=".ydk,.txt,text/plain"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              Upload .ydk or .txt
            </label>
            <button
              className="rounded-xl bg-yellow-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isParsing || input.trim().length === 0}
              onClick={parseDeck}
            >
              {isParsing ? "Resolving cards..." : "Parse & preview"}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Export options</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-200">
            <OptionCheckbox
              label="Include main deck"
              checked={options.includeMain}
              onChange={(checked) => setOptions((current) => ({ ...current, includeMain: checked }))}
            />
            <OptionCheckbox
              label="Include extra deck"
              checked={options.includeExtra}
              onChange={(checked) => setOptions((current) => ({ ...current, includeExtra: checked }))}
            />
            <OptionCheckbox
              label="Include side deck"
              checked={options.includeSide}
              onChange={(checked) => setOptions((current) => ({ ...current, includeSide: checked }))}
            />
            <OptionCheckbox
              label="Draw cut borders"
              checked={options.drawCutBorders}
              onChange={(checked) => setOptions((current) => ({ ...current, drawCutBorders: checked }))}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-xl border border-yellow-300 bg-yellow-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!canExport || exportingFormat !== null}
              onClick={() => exportDeck("pdf")}
            >
              {exportingFormat === "pdf" ? "Creating PDF..." : "Download PDF"}
            </button>
            <button
              className="rounded-xl border border-slate-500 px-4 py-3 font-semibold text-slate-100 transition hover:border-yellow-300 hover:text-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!canExport || exportingFormat !== null}
              onClick={() => exportDeck("docx")}
            >
              {exportingFormat === "docx" ? "Creating Word..." : "Download Word"}
            </button>
          </div>

          <p className="mt-4 text-sm text-slate-400">
            {resolution
              ? `${printableCount} selected cards, ${Math.max(1, Math.ceil(printableCount / 9))} page(s).`
              : "Parse a deck before exporting."}
          </p>
        </div>
      </section>

      {resolution ? <DeckPreview resolution={resolution} /> : null}
    </main>
  );
}

function OptionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <input
        className="h-4 w-4 accent-yellow-300"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function DeckPreview({ resolution }: { resolution: DeckResolution }) {
  const previewCards = resolution.cards.slice(0, 9);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Deck preview</h2>
          <p className="mt-2 text-slate-300">
            Main {resolution.counts.main} · Extra {resolution.counts.extra} · Side {resolution.counts.side}
          </p>
        </div>
        <p className="text-sm text-slate-400">
          Showing first 9 cards. Export keeps the original deck order.
        </p>
      </div>

      {resolution.unresolved.length > 0 ? (
        <div className="mt-5 rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p className="font-semibold">Some cards could not be resolved:</p>
          <ul className="mt-2 list-disc pl-5">
            {resolution.unresolved.map((card) => (
              <li key={card.instanceId}>{card.passcode}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-slate-900 p-3 sm:gap-4 sm:p-4">
        {previewCards.map((card) => (
          <div
            className="flex aspect-[421/614] items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
            key={card.instanceId}
          >
            {card.card ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="h-full w-full object-contain"
                src={card.card.imageUrlSmall ?? card.card.imageUrl}
                alt={card.card.name}
              />
            ) : (
              <span className="px-2 text-center text-xs text-slate-400">Missing {card.passcode}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
