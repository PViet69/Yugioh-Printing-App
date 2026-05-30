import { describe, expect, it } from "vitest";
import { parseDeckInput } from "./deck-input";
import { buildYdkeFromSections } from "./ydke";

describe("parseDeckInput", () => {
  it("parses YDKE links", () => {
    const ydke = buildYdkeFromSections({ main: [89631139] });

    expect(parseDeckInput(ydke).main).toEqual(["89631139"]);
  });

  it("parses classic .ydk text files", () => {
    const parsed = parseDeckInput(`#created by test
#main
89631139
89631139
#extra
44508094
!side
53129443`);

    expect(parsed).toEqual({
      main: ["89631139", "89631139"],
      extra: ["44508094"],
      side: ["53129443"],
      allIds: ["89631139", "89631139", "44508094", "53129443"],
    });
  });
});
