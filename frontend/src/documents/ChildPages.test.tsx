import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { moveDocument } from "../api/documents";
import { ChildPages } from "./ChildPages";

vi.mock("../api/documents", () => ({
  listDocuments: vi.fn(() => Promise.resolve([
    { id: 1, spaceId: 1, spaceName: "스쿨북스", title: "테스트2", icon: null, updatedByName: null, updatedAt: "", parentId: null, kind: "PAGE", fileUrl: null },
    { id: 2, spaceId: 1, spaceName: "스쿨북스", title: "테스트1", icon: null, updatedByName: null, updatedAt: "", parentId: 1, kind: "PAGE", fileUrl: null },
    { id: 3, spaceId: 1, spaceName: "스쿨북스", title: "테스트 2-1", icon: null, updatedByName: null, updatedAt: "", parentId: 1, kind: "PAGE", fileUrl: null },
  ])),
  createDocument: vi.fn(),
  moveDocument: vi.fn(() => Promise.resolve({})),
}));

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChildPages spaceId={1} parentId={1} />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

const dataTransfer = () => ({ setData: vi.fn(), clearData: vi.fn(), effectAllowed: "", dropEffect: "" });
const row = (title: string) => screen.getByText(title).closest(".child-page-row")!;
const handle = (title: string) => screen.getByLabelText(`${title} 끌어서 순서 변경`);

// jsdom은 배치를 계산하지 않아 줄마다 높이 30px로 위에서부터 쌓인 위치를 넣음 (0~30, 30~60, ...)
// jsdom의 끌기 이벤트는 clientY를 받지 않아 직접 넣어서 발생
function dragAt(type: "dragOver" | "drop", el: Element, clientY: number) {
  document.querySelectorAll(".child-page-row").forEach((rowEl, i) => {
    rowEl.getBoundingClientRect = () => ({ top: i * 30, height: 30, bottom: i * 30 + 30, left: 0, right: 200, width: 200 }) as DOMRect;
  });
  const event = createEvent[type](el, { dataTransfer: dataTransfer() });
  Object.defineProperty(event, "clientY", { value: clientY });
  fireEvent(el, event);
}

describe("ChildPages", () => {
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
  });

  beforeEach(() => vi.mocked(moveDocument).mockClear());
  afterEach(cleanup);

  it("하위 페이지를 다른 줄 위쪽 절반에 놓으면 가로선을 보이고 그 앞으로 순서를 바꾼다", async () => {
    renderList();
    await screen.findByText("테스트 2-1");
    const transfer = dataTransfer();
    fireEvent.dragStart(handle("테스트 2-1"), { dataTransfer: transfer });
    expect(transfer.clearData).toHaveBeenCalled();
    dragAt("dragOver", row("테스트1"), 5);
    expect(row("테스트1").getAttribute("data-drop-position")).toBe("before");
    dragAt("drop", row("테스트1"), 5);
    // 같은 상위(1) 안에서 맨 위(0)로
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(3, 1, 0));
  });

  it("아래쪽 절반에 놓으면 그 뒤로 옮긴다", async () => {
    renderList();
    await screen.findByText("테스트1");
    fireEvent.dragStart(handle("테스트1"), { dataTransfer: dataTransfer() });
    dragAt("drop", row("테스트 2-1"), 55);
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(2, 1, 1));
  });

  it("줄 위가 아니어도 목록 아래쪽(+ 페이지 추가 줄)에 놓으면 맨 뒤로 옮긴다", async () => {
    renderList();
    await screen.findByText("테스트1");
    fireEvent.dragStart(handle("테스트1"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", screen.getByText("+ 페이지 추가"), 75);
    expect(row("테스트 2-1").getAttribute("data-drop-position")).toBe("after");
    dragAt("drop", screen.getByText("+ 페이지 추가"), 75);
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(2, 1, 1));
  });

  it("목록 제목 쪽(첫 줄 위)에 놓으면 맨 앞으로 옮긴다", async () => {
    renderList();
    await screen.findByText("테스트 2-1");
    fireEvent.dragStart(handle("테스트 2-1"), { dataTransfer: dataTransfer() });
    dragAt("drop", screen.getByText("하위 페이지"), -10);
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(3, 1, 0));
  });

  it("줄의 링크는 끌리지 않고 왼쪽 ⠿ 손잡이만 끌 수 있다", async () => {
    renderList();
    await screen.findByText("테스트1");
    expect(screen.getByText("테스트1").closest("a")!.getAttribute("draggable")).toBe("false");
    expect(handle("테스트1").getAttribute("draggable")).toBe("true");
  });

  it("자기 줄에 놓으면 아무 변화가 없다", async () => {
    renderList();
    await screen.findByText("테스트1");
    fireEvent.dragStart(handle("테스트1"), { dataTransfer: dataTransfer() });
    dragAt("drop", row("테스트1"), 25);
    expect(moveDocument).not.toHaveBeenCalled();
  });

  it("일정 블록용 WBS는 본문 블록으로만 만들므로 + WBS 추가 버튼이 없다", async () => {
    renderList();
    await screen.findByText("+ 페이지 추가");
    expect(screen.queryByText("+ WBS 추가")).toBeNull();
  });
});
