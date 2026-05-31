# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install dependencies: `npm install`
- Start the development server: `npm run dev`
- Start with Docker: `docker compose up --build` (serves on <http://localhost:3000>)
- Build production bundle: `npm run build`
- Start production server after build: `npm start`
- Lint: `npm run lint`
- Run tests once: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run a single test file: `npx vitest run src/lib/ydke.test.ts`
- Run tests matching a name: `npx vitest run -t "parseYdke"`

## Architecture

This is a Next.js App Router application for turning Yu-Gi-Oh deck inputs into print-ready sheets. The app accepts YDKE URLs or `.ydk`/text files, resolves card metadata/images through YGOPRODeck, and exports A4 3×3 card pages as PDF and DOCX.

### User flow and API boundaries

- `src/app/page.tsx` renders the client-side `DeckPrinter` UI from `src/app/DeckPrinter.tsx`.
- The client posts deck input to `POST /api/deck/parse` for validation, parsing, YGOPRODeck resolution, and preview data.
- The client posts the same input plus export options to `POST /api/export/pdf` or `POST /api/export/docx` to receive a downloadable file.
- Export routes return skipped/unresolved cards in the `X-Missing-Cards` response header, serialized by `src/lib/export-result.ts`; the client decodes this header to show skipped cards.

There is also `src/components/DeckPrinter.tsx`, an older/alternate client component that only supports PDF export and uses a relative `../lib/*` import style. The active page imports `src/app/DeckPrinter.tsx`.

### Deck parsing and resolution

- `src/lib/deck-input.ts` chooses between YDKE parsing and `.ydk`-style text parsing.
- `src/lib/ydke.ts` handles YDKE URL extraction, base64 section decoding, and YDKE construction helpers. YDKE card IDs are decoded as little-endian 32-bit integers.
- `src/lib/ygoprodeck.ts` resolves unique passcodes against `https://db.ygoprodeck.com/api/v7/cardinfo.php`, limits concurrent card lookups to 6, and exposes `fetchImageBytes()` for export image downloads. Fetches use Next `revalidate` caching for one week.
- Shared domain types and defaults are in `src/lib/types.ts`.

### Export pipeline

- Request validation lives in `src/lib/export-request.ts` using Zod. `MAX_PRINTABLE_CARDS` is currently 120 and is enforced by both parse and export flows.
- `src/lib/export-common.ts` centralizes export preparation: parse input, enforce card limit, resolve the deck, filter selected sections, and reject empty exports.
- `src/lib/print-layout.ts` owns the shared A4 print geometry: 3 columns × 3 rows, 9 cards per page, millimeter-to-point conversion, card placement, chunking, and section filtering.
- `src/lib/export-pdf.ts` uses `pdf-lib`; it downloads card images, embeds PNG/JPG images, places them with `calculateCardPlacement()`, and skips unresolved or failed image downloads.
- `src/lib/export-docx.ts` uses `docx`; it builds fixed A4 tables with 9 cells per page and inserts card images into each cell.

### Testing focus

Unit tests currently cover parsing and layout utilities in `src/lib/*.test.ts`:

- `deck-input.test.ts` for `.ydk`/text parsing behavior
- `ydke.test.ts` for YDKE parsing/building
- `print-layout.test.ts` for A4/card placement helpers
- `ygoprodeck.test.ts` for card resolution/concurrency helpers

When changing export behavior, prefer adding or updating tests around shared library functions (`deck-input`, `ydke`, `print-layout`, `ygoprodeck`, or export helpers) rather than only testing the UI.

## Project notes

- The project uses TypeScript with `@/*` path aliases pointing at `src/*`.
- Styling is Tailwind-style utility classes in React components plus global styles in `src/app/globals.css`.
- External YGOPRODeck/API or image fetch failures are represented as unresolved/missing cards where possible so exports can still complete with skipped cards.
