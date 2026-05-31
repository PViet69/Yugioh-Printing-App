"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_EXPORT_OPTIONS,
  type CardInstance,
  type ExportOptions,
  type MissingCard,
} from "../lib/types";

type ExportFormat = "pdf";

type DeckStats = { total: number; pages: number };

type DeckResolutionState = {
  cards: CardInstance[];
  unresolved: CardInstance[];
  originalUnresolved: CardInstance[];
};

type MissingCardGroup = {
  passcode: string;
  count: number;
  locations: string[];
  previewUrl?: string;
};

type PrintMode = "single" | "multi";

type PrintFileDraft = {
  id: string;
  name: string;
  input: string;
  cardCount: number;
};

let printFileIdCounter = 0;

function createPrintFile(name = "Deck 1", input = ""): PrintFileDraft {
  printFileIdCounter += 1;

  return {
    id: `print-file-${printFileIdCounter}`,
    name,
    input,
    cardCount: countCardsInDeckText(input),
  };
}

export function DeckPrinter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [printMode, setPrintMode] = useState<PrintMode>("single");
  const [printFiles, setPrintFiles] = useState<PrintFileDraft[]>(() => [createPrintFile()]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [lastPreparedSignature, setLastPreparedSignature] = useState<string | null>(null);
  const [deckStats, setDeckStats] = useState<DeckStats | null>(null);
  const [resolution, setResolution] = useState<DeckResolutionState | null>(null);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [missingCards, setMissingCards] = useState<MissingCard[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  async function loadDeckFile(file: File | null) {
    if (!file) return;

    if (!isSupportedDeckFile(file)) {
      setError("Please upload a .ydk, .ydke, or .txt deck file.");
      return;
    }

    const fileText = await file.text();
    setUploadedFileName(file.name);
    setPrintFiles((current) => updatePrintFile(current, current[0]?.id, {
      name: file.name,
      input: fileText,
      cardCount: countCardsInDeckText(fileText),
    }));
    setDeckStats(null);
    setResolution(null);
    setError(null);
    setMissingCards([]);
  }

  function handleDrag(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    handleDrag(event);
    setIsDraggingFile(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    handleDrag(event);

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingFile(false);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    handleDrag(event);
    setIsDraggingFile(false);
    await loadDeckFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function parseDeck() {
    setIsParsing(true);
    setError(null);
    setMissingCards([]);
    setDeckStats(null);
    setResolution(null);

    try {
      const response = await fetch("/api/deck/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDeckRequestBody(printMode, printFiles)),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to parse this deck.");
      }

      const cards = payload.cards as CardInstance[];
      const unresolved = cards.filter((card) => !card.card);
      const selectedCards = filterSelectedCards(cards, options);
      const selectedResolvedCards = selectedCards.filter((card) => card.card);
      setDeckStats({
        total: selectedResolvedCards.length,
        pages: Math.max(1, Math.ceil(selectedResolvedCards.length / 9)),
      });
      setResolution({ cards, unresolved, originalUnresolved: unresolved });
      setLastPreparedSignature(getPrintSignature(printMode, printFiles));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to parse this deck.");
    } finally {
      setIsParsing(false);
    }
  }

  async function exportDeck(format: ExportFormat) {
    setExportingFormat(format);
    setError(null);
    setMissingCards([]);

    try {
      const manualCards = getManualCards(resolution?.cards ?? []);
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildDeckRequestBody(printMode, printFiles),
          options,
          manualCards,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Export failed." }));
        throw new Error(payload.error ?? "Export failed.");
      }

      const missingCards = readMissingCardsHeader(response.headers.get("x-missing-cards"));
      setMissingCards(missingCards);

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "SIL.pdf";
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

  function addManualCard(passcode: string, imageUrl: string) {
    setResolution((current) => {
      if (!current) return current;

      const cards = current.cards.map((card) => {
        if (card.passcode !== passcode || card.card) return card;

        return {
          ...card,
          card: {
            passcode: card.passcode,
            id: Number(card.passcode) || 0,
            name: `Card ${card.passcode}`,
            imageUrl,
            imageUrlSmall: imageUrl,
            source: "manual" as const,
          },
          error: undefined,
        };
      });

      updateDeckStats(cards, options);
      return {
        ...current,
        cards,
        unresolved: cards.filter((card) => !card.card),
      };
    });
  }

  function updateDeckStats(cards: CardInstance[], nextOptions: ExportOptions) {
    const selectedResolvedCards = filterSelectedCards(cards, nextOptions).filter((card) => card.card);
    setDeckStats({
      total: selectedResolvedCards.length,
      pages: Math.max(1, Math.ceil(selectedResolvedCards.length / 9)),
    });
  }

  function updateOptions(nextOptions: ExportOptions) {
    setOptions(nextOptions);

    if (resolution) {
      updateDeckStats(resolution.cards, nextOptions);
    }
  }

  function clearFile() {
    setPrintFiles((current) => updatePrintFile(current, current[0]?.id, { name: "Deck 1", input: "", cardCount: 0 }));
    setUploadedFileName(null);
    setDeckStats(null);
    setResolution(null);
    setError(null);
    setMissingCards([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function loadMultiplePrintFiles(fileList: FileList | File[] | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    const unsupportedFile = files.find((file) => !isSupportedDeckFile(file));

    if (unsupportedFile) {
      setError(`${unsupportedFile.name} is not a supported .ydk, .ydke, or .txt deck file.`);
      return;
    }

    const loadedFiles = await Promise.all(
      files.map(async (file) => createPrintFile(file.name, await file.text())),
    );

    setPrintFiles((current) => {
      const hasOnlyEmptyPlaceholder = current.length === 1 && current[0].input.trim().length === 0;
      return hasOnlyEmptyPlaceholder ? loadedFiles : [...current, ...loadedFiles];
    });
    setResolution(null);
    setDeckStats(null);
    setError(null);
    setMissingCards([]);
  }


  function removePrintFile(id: string) {
    setPrintFiles((current) => current.filter((file) => file.id !== id));
    setResolution(null);
    setDeckStats(null);
  }

  const currentPrintSignature = getPrintSignature(printMode, printFiles);
  const isPreparedCurrent = resolution !== null && lastPreparedSignature === currentPrintSignature;
  const hasPrintableInput = getActivePrintFiles(printMode, printFiles).length > 0;
  const unresolvedSelectedCount = resolution
    ? filterSelectedCards(resolution.unresolved, options).length
    : 0;
  const canPrepare = !isParsing && hasPrintableInput && !isPreparedCurrent;
  const canExport = isPreparedCurrent && deckStats !== null && deckStats.total > 0 && unresolvedSelectedCount === 0;

  return (
    <main className="min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(22,163,74,0.22),transparent_28rem),radial-gradient(circle_at_top_right,rgba(217,119,6,0.18),transparent_24rem),linear-gradient(135deg,#0f172a_0%,#111827_48%,#052e1a_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur md:p-10">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-yellow-300/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Yu-Gi-Oh Printing.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                Upload a deck file, prepare the card list, then download a PDF arranged as 9 cards per page.
              </p>
            </div>

          
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Step 1</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Upload your deck</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Supports .ydk, .ydke, and .txt files. Drag a file here or choose one from your device.
                </p>
              </div>
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 sm:flex">
                <FileIcon />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-1 text-sm font-bold">
              <button
                className={`rounded-xl px-4 py-3 transition ${printMode === "single" ? "bg-yellow-300 text-slate-950" : "text-slate-300 hover:text-yellow-100"}`}
                type="button"
                onClick={() => setPrintMode("single")}
              >
                Single file print
              </button>
              <button
                className={`rounded-xl px-4 py-3 transition ${printMode === "multi" ? "bg-yellow-300 text-slate-950" : "text-slate-300 hover:text-yellow-100"}`}
                type="button"
                onClick={() => setPrintMode("multi")}
              >
                Multi-file print
              </button>
            </div>

            {printMode === "single" ? (
              <div
                className={`mt-6 rounded-3xl border border-dashed p-5 transition ${
                  isDraggingFile
                    ? "border-yellow-300 bg-yellow-300/10 ring-4 ring-yellow-300/20"
                    : "border-emerald-300/35 bg-slate-950/55"
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDrag}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  id="deck-file-upload"
                  type="file"
                  accept=".ydk,.ydke,.txt,text/plain"
                  onChange={(event) => loadDeckFile(event.target.files?.[0] ?? null)}
                />
                <label
                  className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center transition hover:border-yellow-300 hover:bg-white/[0.09] focus-within:border-yellow-300 focus-within:ring-4 focus-within:ring-yellow-300/20"
                  htmlFor="deck-file-upload"
                >
                  <span className="text-base font-bold text-yellow-100">
                    {isDraggingFile ? "Drop deck file here" : "Upload or drop .ydk/.ydke/.txt"}
                  </span>
                  <span className="mt-2 break-all text-sm text-slate-300">
                    {uploadedFileName ? `Selected: ${uploadedFileName}` : "Click to choose a file, or drag it into this area."}
                  </span>
                  {printFiles[0]?.input.trim() ? (
                    <span className="mt-3 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-100">
                      {printFiles[0].cardCount} cards
                    </span>
                  ) : null}
                </label>

                {uploadedFileName ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-yellow-300 hover:text-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-300/20"
                      type="button"
                      onClick={clearFile}
                    >
                      Clear file
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                <MultiFileDropZone onLoadFiles={loadMultiplePrintFiles} />
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm font-bold text-yellow-100">Print file list</p>
                  <div className="mt-3 grid gap-2">
                    {getActivePrintFiles("multi", printFiles).length > 0 ? (
                      getActivePrintFiles("multi", printFiles).map((file, index) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm"
                          key={file.id}
                        >
                          <span className="min-w-0 flex-1 break-all text-slate-200">
                            {index + 1}. {file.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-100">
                            {file.cardCount} cards
                          </span>
                          <button
                            className="rounded-lg border border-white/10 px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-rose-300 hover:text-rose-100"
                            type="button"
                            onClick={() => removePrintFile(file.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-sm text-slate-400">
                        No files added yet. Drop multiple deck files above.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="min-h-12 rounded-2xl bg-yellow-300 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-yellow-950/20 transition hover:-translate-y-0.5 hover:bg-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-300/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={!canPrepare}
                onClick={parseDeck}
              >
                {isParsing ? "Reading deck..." : "Prepare download"}
              </button>
              <p className="text-sm text-slate-400">Prepare once before downloading.</p>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100" role="alert">
                <p className="font-semibold">Something went wrong</p>
                <p className="mt-1">{error}</p>
              </div>
            ) : null}

            {resolution?.originalUnresolved.length ? (
              <MissingCardsEditor cards={resolution.originalUnresolved} resolvedCards={resolution.cards} onAddManualCard={addManualCard} />
            ) : null}
          </div>

          <aside className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20 backdrop-blur md:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Step 2</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Export options</h2>

            <div className="mt-5 space-y-3 text-sm text-slate-200">
              <OptionCheckbox
                label="Include main deck"
                checked={options.includeMain}
                onChange={(checked) => updateOptions({ ...options, includeMain: checked })}
              />
              <OptionCheckbox
                label="Include extra deck"
                checked={options.includeExtra}
                onChange={(checked) => updateOptions({ ...options, includeExtra: checked })}
              />
              <OptionCheckbox
                label="Include side deck"
                checked={options.includeSide}
                onChange={(checked) => updateOptions({ ...options, includeSide: checked })}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Status</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {deckStats
                  ? `${deckStats.total} selected cards · ${deckStats.pages} page(s)`
                  : "Prepare a deck to unlock downloads."}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Missing cards will be skipped before export
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                className="min-h-12 rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-300/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={!canExport || exportingFormat !== null}
                onClick={() => exportDeck("pdf")}
              >
                {exportingFormat === "pdf" ? "Creating PDF..." : "Download PDF"}
              </button>
            </div>

            {missingCards.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
                <p className="font-semibold">These cards are missing and will be skipped:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {missingCards.map((card) => (
                    <li key={card.instanceId}>
                      {card.name ? `${card.name} (${card.passcode})` : card.passcode}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function MultiFileDropZone({ onLoadFiles }: { onLoadFiles: (files: FileList | null) => void }) {
  const inputId = "multi-file-upload";
  const [isDragging, setIsDragging] = useState(false);

  function handleDrag(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragEnter(event: React.DragEvent<HTMLLabelElement>) {
    handleDrag(event);
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    handleDrag(event);

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    handleDrag(event);
    setIsDragging(false);
    onLoadFiles(event.dataTransfer.files);
  }

  return (
    <div>
      <input
        className="sr-only"
        id={inputId}
        type="file"
        multiple
        accept=".ydk,.ydke,.txt,text/plain"
        onChange={(event) => onLoadFiles(event.target.files)}
      />
      <label
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-5 text-center transition ${
          isDragging
            ? "border-yellow-300 bg-yellow-300/10 ring-4 ring-yellow-300/20"
            : "border-emerald-300/35 bg-slate-950/55 hover:border-yellow-300 hover:bg-white/[0.06]"
        }`}
        htmlFor={inputId}
        onDragEnter={handleDragEnter}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-base font-bold text-yellow-100">
          {isDragging ? "Drop deck files here" : "Upload or drop multiple deck files"}
        </span>
        <span className="mt-2 text-sm text-slate-300">
          Files are added immediately to the print list below.
        </span>
      </label>
    </div>
  );
}

function MissingCardsEditor({
  cards,
  resolvedCards,
  onAddManualCard,
}: {
  cards: CardInstance[];
  resolvedCards: CardInstance[];
  onAddManualCard: (passcode: string, imageUrl: string) => void;
}) {
  const manualPreviewByPasscode = getManualPreviewByPasscode(resolvedCards);
  const groupedCards = groupMissingCards(cards, manualPreviewByPasscode);

  return (
    <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
      <p className="font-semibold">Missing cards</p>
      <p className="mt-1 leading-6 text-amber-100/85">
        These passcodes were not found , upload one image for each passcode.
      </p>
      <div className="mt-4 grid gap-3">
        {groupedCards.map((group) => (
          <MissingCardForm group={group} key={group.passcode} onAddManualCard={onAddManualCard} />
        ))}
      </div>
    </div>
  );
}

function MissingCardForm({
  group,
  onAddManualCard,
}: {
  group: MissingCardGroup;
  onAddManualCard: (passcode: string, imageUrl: string) => void;
}) {
  const inputId = `missing-card-image-${group.passcode}`;
  const [imageName, setImageName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(group.previewUrl ?? null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  async function loadCardImage(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setValidationError("Please upload an image file for this card.");
      return;
    }

    const imageDataUrl = await readFileAsDataUrl(file);
    setImageName(file.name);
    setPreviewUrl(imageDataUrl);
    setValidationError(null);
    onAddManualCard(group.passcode, imageDataUrl);
  }

  function handleImageDrag(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleImageDragEnter(event: React.DragEvent<HTMLLabelElement>) {
    handleImageDrag(event);
    setIsDraggingImage(true);
  }

  function handleImageDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    handleImageDrag(event);

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingImage(false);
  }

  async function handleImageDrop(event: React.DragEvent<HTMLLabelElement>) {
    handleImageDrag(event);
    setIsDraggingImage(false);
    await loadCardImage(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <p className="font-semibold text-yellow-100">
        Passcode {group.passcode} · Missing {group.count} {group.count === 1 ? "copy" : "copies"}
      </p>
      <p className="mt-1 text-xs text-amber-100/70">{group.locations.join(", ")}</p>
      <input
        className="sr-only"
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(event) => loadCardImage(event.target.files?.[0] ?? null)}
      />
      <label
        className={`mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center transition ${
          previewUrl
            ? "border-emerald-300 bg-emerald-500/10 ring-4 ring-emerald-300/15"
            : isDraggingImage
              ? "border-yellow-300 bg-yellow-300/10 ring-4 ring-yellow-300/20"
              : "border-amber-200/30 bg-slate-900/70 hover:border-yellow-300 hover:bg-white/[0.06]"
        }`}
        htmlFor={inputId}
        onDragEnter={handleImageDragEnter}
        onDragOver={handleImageDrag}
        onDragLeave={handleImageDragLeave}
        onDrop={handleImageDrop}
      >
        {previewUrl ? (
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="h-28 w-20 rounded-lg border border-emerald-200/40 bg-slate-950 object-contain shadow-lg shadow-emerald-950/30"
              src={previewUrl}
              alt={`Preview for card ${group.passcode}`}
            />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-bold text-emerald-100">
                <span aria-hidden="true">✓</span>
                Image added
              </span>
              <p className="mt-2 break-all text-xs text-emerald-100/80">{imageName}</p>
              <p className="mt-1 text-xs text-emerald-100/65">Click or drop another image to replace it.</p>
            </div>
          </div>
        ) : (
          <>
            <span className="font-semibold text-yellow-100">
              {isDraggingImage ? "Drop card image here" : "Upload or drop card image"}
            </span>
            <span className="mt-2 break-all text-xs text-amber-100/75">
              PNG, JPG, WebP, or another image file
            </span>
          </>
        )}
      </label>
      {validationError ? <p className="mt-2 text-xs text-rose-200">{validationError}</p> : null}
    </div>
  );
}

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h6.4L18 8.35v11.9H7a1.5 1.5 0 0 1-1.5-1.5V5.25A1.5 1.5 0 0 1 7 3.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.25 4v4.6h4.6M8.75 13h6.5M8.75 16h4.25" />
    </svg>
  );
}

function readMissingCardsHeader(value: string | null): MissingCard[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? (parsed as MissingCard[]) : [];
  } catch {
    return [];
  }
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
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:border-yellow-300/70 hover:bg-white/[0.09]">
      <input
        className="h-5 w-5 accent-yellow-300"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

function filterSelectedCards(cards: CardInstance[], options: ExportOptions): CardInstance[] {
  return cards.filter((card) => {
    if (card.section === "main") return options.includeMain;
    if (card.section === "extra") return options.includeExtra;
    return options.includeSide;
  });
}

function getManualCards(cards: CardInstance[]) {
  return cards.flatMap((card) => {
    if (card.card?.source !== "manual") return [];

    return [
      {
        instanceId: card.instanceId,
        passcode: card.passcode,
        name: card.card.name,
        imageUrl: card.card.imageUrl,
      },
    ];
  });
}

function isSupportedDeckFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return (
    fileName.endsWith(".ydk") ||
    fileName.endsWith(".ydke") ||
    fileName.endsWith(".txt") ||
    file.type === "text/plain" ||
    file.type === ""
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this image file."));
    reader.readAsDataURL(file);
  });
}

function countCardsInDeckText(input: string): number {
  return input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line)).length;
}

function groupMissingCards(
  cards: CardInstance[],
  manualPreviewByPasscode: Map<string, string>,
): MissingCardGroup[] {
  const groups = new Map<string, MissingCardGroup>();

  cards.forEach((card) => {
    const current = groups.get(card.passcode) ?? {
      passcode: card.passcode,
      count: 0,
      locations: [],
      previewUrl: manualPreviewByPasscode.get(card.passcode),
    };

    current.count += 1;
    current.locations.push(`${card.section} #${card.sectionIndex + 1}`);
    groups.set(card.passcode, current);
  });

  return [...groups.values()];
}

function getManualPreviewByPasscode(cards: CardInstance[]): Map<string, string> {
  const previews = new Map<string, string>();

  cards.forEach((card) => {
    if (card.card?.source === "manual") {
      previews.set(card.passcode, card.card.imageUrl);
    }
  });

  return previews;
}

function updatePrintFile(
  files: PrintFileDraft[],
  fileId: string | undefined,
  changes: Partial<PrintFileDraft>,
): PrintFileDraft[] {
  if (!fileId) return files;
  return files.map((file) => (file.id === fileId ? { ...file, ...changes } : file));
}

function getActivePrintFiles(printMode: PrintMode, printFiles: PrintFileDraft[]): PrintFileDraft[] {
  const files = printMode === "single" ? printFiles.slice(0, 1) : printFiles;
  return files.filter((file) => file.input.trim().length > 0);
}

function buildDeckRequestBody(printMode: PrintMode, printFiles: PrintFileDraft[]) {
  const activeFiles = getActivePrintFiles(printMode, printFiles);

  if (printMode === "single") {
    return { input: activeFiles[0]?.input ?? "" };
  }

  return {
    inputs: activeFiles.map(({ id, name, input }) => ({ id, name, input })),
  };
}

function getPrintSignature(printMode: PrintMode, printFiles: PrintFileDraft[]): string {
  const files = printMode === "single" ? printFiles.slice(0, 1) : printFiles;

  return JSON.stringify({
    mode: printMode,
    files: files.map(({ id, name, input }) => ({
      id,
      name,
      input: input.trim(),
    })),
  });
}

