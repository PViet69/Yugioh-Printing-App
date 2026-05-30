import { describe, expect, it } from "vitest";
import { A4_PAGE, calculateCardPlacement, chunkCards, fitAspectRatio } from "./print-layout";

describe("chunkCards", () => {
  it("chunks cards into groups of 9", () => {
    expect(chunkCards(Array.from({ length: 19 }, (_, index) => index))).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      [9, 10, 11, 12, 13, 14, 15, 16, 17],
      [18],
    ]);
  });
});

describe("fitAspectRatio", () => {
  it("preserves the given aspect ratio", () => {
    const fitted = fitAspectRatio(100, 200, 0.5);

    expect(fitted).toEqual({ width: 100, height: 200 });
  });

  it("fits inside short cells", () => {
    const fitted = fitAspectRatio(200, 100, 0.5);

    expect(fitted.height).toBe(100);
    expect(fitted.width).toBe(50);
  });
});

describe("calculateCardPlacement", () => {
  it("keeps placements inside the A4 page", () => {
    for (let index = 0; index < 9; index += 1) {
      const placement = calculateCardPlacement(index);

      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.width).toBeLessThanOrEqual(A4_PAGE.width);
      expect(placement.y + placement.height).toBeLessThanOrEqual(A4_PAGE.height);
    }
  });

  it("calculates row and column on each page", () => {
    expect(calculateCardPlacement(0)).toMatchObject({ row: 0, column: 0, pageIndex: 0 });
    expect(calculateCardPlacement(8)).toMatchObject({ row: 2, column: 2, pageIndex: 0 });
    expect(calculateCardPlacement(9)).toMatchObject({ row: 0, column: 0, pageIndex: 1 });
  });
});
