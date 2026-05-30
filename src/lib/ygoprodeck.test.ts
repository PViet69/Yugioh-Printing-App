import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCards, resolveDeck } from "./ygoprodeck";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("resolveCards", () => {
  it("de-duplicates card IDs before fetching", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 89631139,
              name: "Blue-Eyes White Dragon",
              card_images: [
                {
                  id: 89631139,
                  image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg",
                  image_url_small: "https://images.ygoprodeck.com/images/cards_small/89631139.jpg",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    globalThis.fetch = fetchMock;

    const cards = await resolveCards(["89631139", "89631139"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cards.get("89631139")?.name).toBe("Blue-Eyes White Dragon");
  });
});

describe("resolveDeck", () => {
  it("maps duplicate card instances back to resolved card data", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 89631139,
              name: "Blue-Eyes White Dragon",
              card_images: [
                {
                  id: 89631139,
                  image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const resolution = await resolveDeck({
      main: ["89631139", "89631139"],
      extra: [],
      side: [],
      allIds: ["89631139", "89631139"],
    });

    expect(resolution.cards).toHaveLength(2);
    expect(resolution.unresolved).toHaveLength(0);
    expect(resolution.cards[0].card?.name).toBe("Blue-Eyes White Dragon");
    expect(resolution.cards[1].card?.name).toBe("Blue-Eyes White Dragon");
  });

  it("returns unresolved card instances for missing cards", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not found", { status: 404 }));

    const resolution = await resolveDeck({
      main: ["1"],
      extra: [],
      side: [],
      allIds: ["1"],
    });

    expect(resolution.unresolved).toHaveLength(1);
    expect(resolution.unresolved[0].error).toMatch(/not found/);
  });
});
