import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SearchDialog } from "./SearchDialog";

vi.mock("../api/documents", () => ({
  searchDocuments: vi.fn((q: string) => Promise.resolve(q === "배포" ? [
    { id: 7, spaceId: 1, spaceName: "team_portal", title: "배포 절차", icon: "🚀", updatedByName: "홍길동", updatedAt: "2026-11-04T10:00:00Z", kind: "PAGE" },
    { id: 8, spaceId: 1, spaceName: "team_portal", title: "배포 체크리스트", icon: null, updatedByName: "홍길동", updatedAt: "2026-11-03T10:00:00Z", kind: "PAGE" },
  ] : q === "자료" ? [
    { id: 7, spaceId: 1, spaceName: "team_portal", title: "자료 정리", icon: null, updatedByName: "홍길동", updatedAt: "2026-11-04T10:00:00Z", kind: "PAGE" },
    { id: 8, spaceId: 1, spaceName: "team_portal", title: "자료 모음", icon: null, updatedByName: "홍길동", updatedAt: "2026-11-03T10:00:00Z", kind: "PAGE" },
    { id: 9, spaceId: 1, spaceName: "team_portal", title: "자료 파일", icon: null, updatedByName: "홍길동", updatedAt: "2026-11-02T10:00:00Z", kind: "FILE" },
  ] : [])),
}));

// 검색어 강조로 제목이 여러 요소로 나뉘어도 제목 전체로 찾음
const titleText = (title: string) => (_: string, el: Element | null) =>
  el?.classList.contains("mantine-Highlight-root") === true && el.textContent === title;

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<SearchDialog opened onClose={onClose} />} />
            <Route path="/documents/:id" element={<div>문서 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
  return onClose;
}

describe("SearchDialog", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it("입력하는 대로 결과를 보여준다", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "배포" } });
    expect(await screen.findByText(titleText("배포 절차"))).toBeTruthy();
    expect(screen.getByText(titleText("배포 체크리스트"))).toBeTruthy();
    // 제목 안 검색어를 강조
    expect(screen.getAllByText("배포", { selector: "mark" })).toHaveLength(2);
    // 아이콘이 있으면 그 아이콘, 없으면 기본 아이콘
    expect(screen.getByText("🚀", { exact: false })).toBeTruthy();
    expect(screen.getByText("📄", { exact: false })).toBeTruthy();
  });

  it("방향키로 고르고 Enter로 문서를 연다", async () => {
    const onClose = renderDialog();
    const input = screen.getByLabelText("문서 검색");
    fireEvent.change(input, { target: { value: "배포" } });
    await screen.findByText(titleText("배포 체크리스트"));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("문서 화면")).toBeTruthy());
    expect(onClose).toHaveBeenCalled();
  });

  it("두 글자 미만이면 안내만 보여준다", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "배" } });
    expect(screen.getByText("두 글자 이상 입력하세요.")).toBeTruthy();
  });

  it("Esc로 닫으면 여는 버튼으로 포커스를 되돌리지 않는다", async () => {
    function Harness() {
      const [opened, setOpened] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpened(true)}>검색 열기</button>
          <SearchDialog opened={opened} onClose={() => setOpened(false)} />
        </>
      );
    }
    const queryClient = new QueryClient();
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Harness />
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    const trigger = screen.getByRole("button", { name: "검색 열기" });
    trigger.focus();
    fireEvent.click(trigger);
    const input = await screen.findByPlaceholderText("문서 제목이나 내용으로 검색");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByPlaceholderText("문서 제목이나 내용으로 검색")).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).not.toBe(trigger);
  });

  it("고르기 모드는 페이지만, 고를 수 없는 페이지는 빼고 보여 주며 Enter로 고른 페이지를 돌려준다", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<SearchDialog opened onClose={onClose}
                pick={{ placeholder: "옮길 페이지 검색", actionLabel: "옮기기", exclude: (doc) => doc.id === 7, onPick }} />} />
              <Route path="/documents/:id" element={<div>문서 화면</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    const input = screen.getByLabelText("옮길 페이지 검색");
    fireEvent.change(input, { target: { value: "자료" } });
    expect(await screen.findByText(titleText("자료 모음"))).toBeTruthy();
    // 지금 페이지(7)와 파일 항목(9)은 고를 수 없음
    expect(screen.queryByText(titleText("자료 정리"))).toBeNull();
    expect(screen.queryByText(titleText("자료 파일"))).toBeNull();
    expect(screen.getByText("옮기기")).toBeTruthy();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 8 }));
    expect(onClose).toHaveBeenCalled();
    // 문서를 열지 않음
    expect(screen.queryByText("문서 화면")).toBeNull();
  });
});
