import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SpaceNavItem } from "./SpaceNavItem";
import { SpaceList } from "./SpaceList";
import { subscribeToast } from "../toast/toastStore";
import { deleteSpace } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";

vi.mock("../api/spaces", () => ({ deleteSpace: vi.fn(() => Promise.resolve()) }));

const space: SpaceDto = { id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, kind: "PROJECT", section: "INTERNAL", icon: "🏫", cover: null };

function renderItem(target: SpaceDto = space) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<SpaceNavItem space={target} />} />
            <Route path="/spaces/:id" element={<div>프로젝트 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("SpaceNavItem", () => {
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
    // jsdom에는 없는 크기 감시 기능 (내보내기 창의 형식 선택이 사용)
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it("프로젝트 줄은 아이콘과 이름만 보이고, 하위 페이지 펼치기·추가 버튼이 없다", () => {
    renderItem();
    expect(screen.getByText("🏫")).toBeTruthy();
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    expect(screen.queryByLabelText("스쿨북스 펼치기")).toBeNull();
    expect(screen.queryByLabelText("스쿨북스에 페이지 추가")).toBeNull();
    expect(screen.getByLabelText("스쿨북스 메뉴")).toBeTruthy();
  });

  it("아이콘이 없는 프로젝트는 폴더 아이콘을 보이고, 누르면 프로젝트 화면으로 간다", async () => {
    renderItem({ ...space, icon: null });
    expect(screen.getByText("📁")).toBeTruthy();
    fireEvent.click(screen.getByText("스쿨북스"));
    expect(await screen.findByText("프로젝트 화면")).toBeTruthy();
  });

  it("최상위 페이지는 아이콘이 없으면 페이지 아이콘, 메뉴·확인 창은 페이지 삭제로 보인다", async () => {
    renderItem({ ...space, kind: "PAGE", icon: null });
    expect(screen.getByText("📄")).toBeTruthy();
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    fireEvent.click(screen.getByLabelText("스쿨북스 메뉴"));
    fireEvent.click(await screen.findByText("페이지 삭제"));
    expect(await screen.findByText(/"스쿨북스" 페이지를 삭제할까요/)).toBeTruthy();
  });

  it("⋯ 메뉴의 프로젝트 삭제는 확인 후 삭제한다", async () => {
    renderItem();
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    fireEvent.click(screen.getByLabelText("스쿨북스 메뉴"));
    fireEvent.click(await screen.findByText("프로젝트 삭제"));
    expect(await screen.findByText(/"스쿨북스" 프로젝트를 삭제할까요/)).toBeTruthy();
    expect(deleteSpace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteSpace).toHaveBeenCalledWith(1));
  });

  it("줄을 선택한 채 Delete 키를 누르면 삭제 확인 창이 뜬다", async () => {
    renderItem();
    fireEvent.keyDown(screen.getByText("스쿨북스").closest("a")!, { key: "Delete" });
    expect(await screen.findByText(/"스쿨북스" 프로젝트를 삭제할까요/)).toBeTruthy();
  });

  it("⋯ 메뉴의 링크 복사는 내보내기 위에 있고 프로젝트 주소를 복사한다", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const toasts: string[] = [];
    const unsubscribe = subscribeToast((message) => toasts.push(message));
    renderItem();
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    fireEvent.click(screen.getByLabelText("스쿨북스 메뉴"));
    const items = (await screen.findAllByRole("menuitem")).map((el) => el.textContent);
    expect(items.indexOf("링크 복사")).toBe(items.indexOf("내보내기") - 1);
    // 가져오기는 내보내기 바로 아래 (페이지·프로젝트 화면 메뉴와 같은 순서)
    expect(items.indexOf("가져오기")).toBe(items.indexOf("내보내기") + 1);
    fireEvent.click(screen.getByText("링크 복사"));
    await waitFor(() => expect(toasts).toEqual(["링크를 복사했습니다"]));
    unsubscribe();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/spaces/1`);
  });

  // 끌기·놓기 이벤트용 가짜 dataTransfer
  const dataTransfer = () => ({ setData: vi.fn(), clearData: vi.fn(), effectAllowed: "", dropEffect: "" });
  // 사이드바 줄(링크) 요소
  const row = (title: string) => screen.getByText(title).closest("a")!;

  // jsdom의 끌기 이벤트는 clientY를 받지 않아 직접 넣어서 발생
  const dragAt = (type: "dragOver" | "drop", el: Element, clientY: number) => {
    const event = createEvent[type](el, { dataTransfer: dataTransfer() });
    Object.defineProperty(event, "clientY", { value: clientY });
    fireEvent(el, event);
  };

  // 프로젝트 목록: 줄마다 높이 30px로 위에서부터 쌓인 위치 (0~30, 30~60, ...)
  const renderSpaceList = (onMove: (id: number, index: number) => void) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SpaceList
              spaces={[{ ...space, id: 1, name: "양식" }, { ...space, id: 2, name: "더북리스트" }, { ...space, id: 3, name: "회계" }]}
              onMove={onMove}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    document.querySelectorAll("[data-space-row]").forEach((el, i) => {
      el.getBoundingClientRect = () => ({ top: i * 30, height: 30, bottom: i * 30 + 30, left: 0, right: 200, width: 200 }) as DOMRect;
    });
  };

  it("끌기를 시작하면 브라우저가 실은 링크 주소를 지운다 (분할 화면 안내 방지)", () => {
    renderSpaceList(vi.fn());
    const transfer = dataTransfer();
    fireEvent.dragStart(row("양식"), { dataTransfer: transfer });
    expect(transfer.clearData).toHaveBeenCalled();
    fireEvent.dragEnd(row("양식"));
  });

  // 내부 프로젝트 칸 [양식, 더북리스트]와 외부 프로젝트 칸 [회계] (외부 칸 줄은 위에서 100px부터)
  const renderTwoSections = (onInternal: (id: number, index: number) => void, onExternal: (id: number, index: number) => void, external = [{ ...space, id: 3, name: "회계", section: "EXTERNAL" as const }]) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SpaceList spaces={[{ ...space, id: 1, name: "양식" }, { ...space, id: 2, name: "더북리스트" }]} onMove={onInternal} />
            <SpaceList spaces={external} onMove={onExternal} />
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    const [internalList, externalList] = screen.getAllByTestId("space-list");
    internalList.querySelectorAll("[data-space-row]").forEach((el, i) => {
      el.getBoundingClientRect = () => ({ top: i * 30, height: 30, bottom: i * 30 + 30, left: 0, right: 200, width: 200 }) as DOMRect;
    });
    externalList.querySelectorAll("[data-space-row]").forEach((el, i) => {
      el.getBoundingClientRect = () => ({ top: 100 + i * 30, height: 30, bottom: 130 + i * 30, left: 0, right: 200, width: 200 }) as DOMRect;
    });
    return { externalList };
  };

  it("다른 칸 줄 위쪽 절반에 놓으면 그 칸의 그 줄 앞으로 옮긴다", () => {
    const onInternal = vi.fn();
    const onExternal = vi.fn();
    renderTwoSections(onInternal, onExternal);
    fireEvent.dragStart(row("양식"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", row("회계"), 105);
    expect(row("회계").getAttribute("data-drop-position")).toBe("before");
    dragAt("drop", row("회계"), 105);
    expect(onExternal).toHaveBeenCalledWith(1, 0);
    expect(onInternal).not.toHaveBeenCalled();
    fireEvent.dragEnd(row("양식"));
  });

  it("다른 칸 맨 아래에 놓으면 그 칸 맨 뒤로 옮긴다 (제자리로 보지 않음)", () => {
    const onExternal = vi.fn();
    renderTwoSections(vi.fn(), onExternal);
    fireEvent.dragStart(row("더북리스트"), { dataTransfer: dataTransfer() });
    dragAt("drop", row("회계"), 125);
    expect(onExternal).toHaveBeenCalledWith(2, 1);
    fireEvent.dragEnd(row("더북리스트"));
  });

  it("빈 칸에도 끌어 놓을 수 있다", () => {
    const onExternal = vi.fn();
    renderTwoSections(vi.fn(), onExternal, []);
    const empty = screen.getByTestId("space-list-empty");
    fireEvent.dragStart(row("양식"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", empty, 100);
    dragAt("drop", empty, 100);
    expect(onExternal).toHaveBeenCalledWith(1, 0);
    fireEvent.dragEnd(row("양식"));
  });

  it("프로젝트 줄을 다른 줄 아래쪽 절반에 놓으면 그 뒤로 순서를 바꾼다", () => {
    const onMove = vi.fn();
    renderSpaceList(onMove);
    fireEvent.dragStart(row("양식"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", row("더북리스트"), 50);
    expect(row("회계").getAttribute("data-drop-position")).toBe("before");
    dragAt("drop", row("더북리스트"), 50);
    // 양식을 뺀 [더북리스트, 회계] 중 더북리스트 뒤 = 1번째
    expect(onMove).toHaveBeenCalledWith(1, 1);
    fireEvent.dragEnd(row("양식"));
  });

  it("프로젝트 목록 아래 빈 곳에 놓으면 맨 뒤로, 첫 줄 위쪽에 놓으면 맨 앞으로 옮긴다", () => {
    const onMove = vi.fn();
    renderSpaceList(onMove);
    fireEvent.dragStart(row("양식"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", screen.getByTestId("space-list"), 300);
    expect(row("회계").getAttribute("data-drop-position")).toBe("after");
    dragAt("drop", screen.getByTestId("space-list"), 300);
    expect(onMove).toHaveBeenCalledWith(1, 2);
    fireEvent.dragEnd(row("양식"));

    fireEvent.dragStart(row("회계"), { dataTransfer: dataTransfer() });
    dragAt("drop", row("양식"), 3);
    expect(onMove).toHaveBeenCalledWith(3, 0);
    fireEvent.dragEnd(row("회계"));
  });
});
