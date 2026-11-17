import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DocumentDetailDto } from "../api/documents";
import { PageView } from "./PageView";

const favorites = vi.hoisted(() => ({
  listFavorites: vi.fn(() => Promise.resolve([] as unknown[])),
  addFavorite: vi.fn((_id: number) => Promise.resolve([{ documentId: 7, spaceId: 1, title: "제목 없음", icon: null, kind: "PAGE", home: false }])),
  removeFavorite: vi.fn((_id: number) => Promise.resolve([] as unknown[])),
}));
vi.mock("../api/favorites", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/favorites")>()), ...favorites }));

// 편집기가 접속 상태에서 받은 "보는 사람"을 위로 알리는 것만 흉내 냄
vi.mock("./CollaborativeEditor", async () => {
  const { useEffect } = await import("react");
  function FakeEditor({ onViewersChange }: { onViewersChange?: (viewers: unknown[]) => void }) {
    useEffect(() => {
      onViewersChange?.([
        { memberId: 1, name: "홍길동", color: "#000" },
        { memberId: 9, name: "이영희", color: "#f80" },
      ]);
    }, [onViewersChange]);
    return <div>편집기</div>;
  }
  return { default: FakeEditor };
});

const doc: DocumentDetailDto = {
  id: 7, spaceId: 1, spaceName: "개발", title: "제목 없음", icon: null, cover: null, createdByName: null,
  updatedByName: null, updatedAt: "2026-11-06T00:00:00Z", home: false, parentId: null, path: [],
  kind: "PAGE", fileUrl: null,
};

function renderPage(state: unknown, over: { doc?: DocumentDetailDto; onChangeCover?: (cover: string | null) => void } = {}) {
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: "/documents/7", state }]}>
        <PageView doc={over.doc ?? doc} user={{ id: 1, name: "홍길동", active: true }} menuItems={null} onRename={vi.fn()}
          onChangeCover={over.onChangeCover} />
      </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("PageView", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("별을 누르면 즐겨찾기에 넣고 노란 별(눌린 상태)로 바뀌며, 다시 누르면 뺀다", async () => {
    renderPage(null);
    const star = await screen.findByRole("button", { name: "즐겨찾기에 추가" });
    expect(star.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(star);
    const filled = await screen.findByRole("button", { name: "즐겨찾기에서 빼기" });
    expect(favorites.addFavorite.mock.calls[0][0]).toBe(7);
    expect(filled.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(filled);
    await screen.findByRole("button", { name: "즐겨찾기에 추가" });
    expect(favorites.removeFavorite.mock.calls[0][0]).toBe(7);
  });

  it("방금 만든 페이지는 제목 칸에 포커스를 주고 제목을 선택해 둔다", async () => {
    renderPage({ focusTitle: 7 });
    const title = screen.getByLabelText("페이지 제목") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(title.selectionStart).toBe(0);
    expect(title.selectionEnd).toBe("제목 없음".length);
  });

  it("그냥 연 페이지는 제목 칸에 포커스를 주지 않는다", async () => {
    renderPage(null);
    expect(await screen.findByText("편집기")).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByLabelText("페이지 제목"));
  });

  it("지금 보고 있는 사람을 나를 포함해 제목 위 오른쪽에 동그라미로 보여 준다", async () => {
    renderPage(null);
    expect((await screen.findByLabelText("홍길동")).textContent).toBe("길동");
    expect(screen.getByLabelText("이영희").textContent).toBe("영희");
  });

  it("커버를 바꿀 수 있는 화면에서 커버가 없으면 커버 추가 버튼만 보인다", async () => {
    renderPage(null, { onChangeCover: vi.fn() });
    expect(await screen.findByText("커버 추가")).toBeTruthy();
    expect(document.querySelector(".page-cover")).toBeNull();
  });

  it("커버가 있으면 제목 위 띠로 보이고 커버 제거를 누르면 지운다", async () => {
    const onChangeCover = vi.fn();
    renderPage(null, { doc: { ...doc, home: true, cover: "att:5" }, onChangeCover });
    const image = document.querySelector(".page-cover img");
    expect(image?.getAttribute("src")).toBe("/api/attachments/5/download");
    expect(screen.getByText("커버 변경")).toBeTruthy();
    expect(screen.queryByText("커버 추가")).toBeNull();
    fireEvent.click(screen.getByText("커버 제거"));
    expect(onChangeCover).toHaveBeenCalledWith(null);
  });

  it("커버를 바꿀 수 없는 일반 페이지는 커버 영역이 없다", async () => {
    renderPage(null, { doc: { ...doc, cover: "att:5" } });
    await screen.findByText("편집기");
    expect(document.querySelector(".page-cover")).toBeNull();
    expect(screen.queryByText("커버 추가")).toBeNull();
  });
});
