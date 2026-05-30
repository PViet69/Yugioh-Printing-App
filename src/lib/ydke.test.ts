import { describe, expect, it } from "vitest";
import { buildYdkeFromSections, parseYdke, YdkeParseError } from "./ydke";

describe("parseYdke", () => {
  it("parses main, extra, and side card IDs", () => {
    const ydke = buildYdkeFromSections({
      main: [89631139, 46986414],
      extra: [44508094],
      side: [53129443],
    });

    expect(parseYdke(ydke)).toEqual({
      main: ["89631139", "46986414"],
      extra: ["44508094"],
      side: ["53129443"],
      allIds: ["89631139", "46986414", "44508094", "53129443"],
    });
  });

  it("preserves duplicates", () => {
    const ydke = buildYdkeFromSections({ main: [89631139, 89631139, 89631139] });

    expect(parseYdke(ydke).main).toEqual(["89631139", "89631139", "89631139"]);
  });

  it("accepts pasted text around the YDKE URL", () => {
    const ydke = buildYdkeFromSections({ main: [89631139] });

    expect(parseYdke(`Deck link: ${ydke}.`).main).toEqual(["89631139"]);
  });

  it("accepts empty sections", () => {
    expect(parseYdke("ydke://!!!")).toEqual({
      main: [],
      extra: [],
      side: [],
      allIds: [],
    });
  });

  it("throws for missing YDKE prefix", () => {
    expect(() => parseYdke("not a deck")).toThrow(YdkeParseError);
  });

  it("throws for invalid section lengths", () => {
    expect(() => parseYdke("ydke://AAA!!!")).toThrow(/decoded byte length/);
  });
});
