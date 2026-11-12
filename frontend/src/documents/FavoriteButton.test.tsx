import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "./FavoriteButton";
import { addFavorite } from "../api/favorites";

const favorite = { documentId: 7, spaceId: 1, title: "회의록", icon: null, kind: "PAGE" as const, home: false };

vi.mock("../api/favorites", () => ({
  FAVORITES_KEY: ["favorites"],
  listFavorites: vi.fn(() => Promise.resolve([])),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(() => Promise.resolve([])),
}));

describe("FavoriteButton", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(cleanup);

  it("누르자마자 노란 별로 바뀌며 한 번 튀어 오르고, 서버 응답 후에도 유지된다", async () => {
    let resolve: (list: typeof favorite[]) => void = () => {};
    vi.mocked(addFavorite).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(
      <MantineProvider>
        <QueryClientProvider client={new QueryClient()}>
          <FavoriteButton documentId={7} />
        </QueryClientProvider>
      </MantineProvider>,
    );
    const button = await screen.findByLabelText("즐겨찾기에 추가");
    fireEvent.click(button);

    // 서버 응답 전
    expect(button.getAttribute("aria-pressed")).toBe("true");
    const star = button.querySelector("svg")!;
    expect(star.hasAttribute("data-pop")).toBe(true);

    resolve([favorite]);
    await waitFor(() => expect(screen.getByLabelText("즐겨찾기에서 빼기").getAttribute("aria-pressed")).toBe("true"));
  });
});
