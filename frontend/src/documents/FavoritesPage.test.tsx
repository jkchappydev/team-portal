import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FavoriteDto } from "../api/favorites";
import { FavoritesPage } from "./FavoritesPage";

const LIST: FavoriteDto[] = [
  { documentId: 3, spaceId: 1, title: "회의록", icon: null, kind: "PAGE", home: false },
  { documentId: 5, spaceId: 2, title: "개발", icon: "🚀", kind: "PAGE", home: true },
  { documentId: 8, spaceId: 1, title: "견적서.xlsx", icon: null, kind: "FILE", home: false },
];

const api = vi.hoisted(() => ({ listFavorites: vi.fn(), moveFavorite: vi.fn() }));
vi.mock("../api/favorites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/favorites")>()), ...api,
}));

function renderPage() {
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <FavoritesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

const dataTransfer = () => ({ clearData: vi.fn(), setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "", dropEffect: "" });

// jsdom은 배치를 계산하지 않아 줄마다 높이 30px로 쌓인 위치를 넣고, 끌기 이벤트의 clientY도 직접 넣음
function dragAt(type: "dragOver" | "drop", el: Element, clientY: number) {
  document.querySelectorAll(".child-page-row").forEach((row, i) => {
    row.getBoundingClientRect = () => ({ top: i * 30, height: 30, bottom: i * 30 + 30, left: 0, right: 200, width: 200 }) as DOMRect;
  });
  const event = createEvent[type](el, { dataTransfer: dataTransfer() });
  Object.defineProperty(event, "clientY", { value: clientY });
  fireEvent(el, event);
}

describe("FavoritesPage", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("즐겨찾기한 페이지를 순서대로 보여 주고, 각 줄은 그 화면으로 이동한다 (프로젝트 본문은 프로젝트 주소)", async () => {
    api.listFavorites.mockResolvedValue(LIST);
    renderPage();

    expect((await screen.findByText("회의록")).closest("a")?.getAttribute("href")).toBe("/documents/3");
    expect(screen.getByText("개발").closest("a")?.getAttribute("href")).toBe("/spaces/2");
    expect(screen.getByText("견적서.xlsx").closest("a")?.getAttribute("href")).toBe("/files/8");
  });

  it("비어 있으면 별을 눌러 추가하라고 안내한다", async () => {
    api.listFavorites.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/즐겨찾기한 페이지가 없습니다/)).toBeTruthy();
  });

  it("손잡이로 끌어 맨 위에 놓으면 그 순서로 저장한다", async () => {
    api.listFavorites.mockResolvedValue(LIST);
    api.moveFavorite.mockResolvedValue([LIST[2], LIST[0], LIST[1]]);
    renderPage();
    await screen.findByText("회의록");

    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole("button", { name: "견적서.xlsx 끌어서 순서 변경" }), { dataTransfer: transfer });
    expect(transfer.clearData).toHaveBeenCalled();
    dragAt("dragOver", screen.getByTestId("favorite-row-3"), 5);
    expect(screen.getByTestId("favorite-row-3").getAttribute("data-drop-position")).toBe("before");
    dragAt("drop", screen.getByTestId("favorite-row-3"), 5);

    await waitFor(() => expect(api.moveFavorite).toHaveBeenCalledWith(8, 0));
  });
});
