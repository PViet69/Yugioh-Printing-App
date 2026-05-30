# Yu-Gi-Oh Card Printing

A Next.js app that accepts YDKE deck links/files, resolves card images through the YGOPRODeck API, and exports print sheets with 9 cards per page as PDF or Word documents.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm test
npm run lint
npm run build
```

## Docker

```bash
docker compose up --build
```

The app will be available at <http://localhost:3000>.

## Workflow

1. Paste a `ydke://...!...!...!` deck link or upload a text file containing one.
2. Parse the deck to resolve card images.
3. Choose main/extra/side sections and optional cut borders.
4. Download a PDF or Word document.
