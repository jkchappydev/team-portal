import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WbsDto, WbsRowDto } from "../api/wbs";
import { createWbsTask, deleteWbsTask, getWbs, moveWbsTask, updateWbsTask } from "../api/wbs";
import { WbsBoard } from "./WbsBoard";

function row(partial: Partial<WbsRowDto>): WbsRowDto {
  return {
    id: 1, parentId: null, depth: 0, hasChildren: false, name: "작업", assignees: [], startDate: null, endDate: null,
    workdays: 0, calendarDays: 0, weight: 0, plannedTotal: 0, actualTotal: 0, plannedPercent: 0, actualPercent: 0,
    ...partial,
  };
}

const data: WbsDto = {
  documentId: 7,
  baseDate: "2023-06-05",
  summary: row({ id: null, name: "전체", hasChildren: true, weight: 100, startDate: "2023-06-01", endDate: "2023-06-09" }),
  tasks: [
    row({ id: 1, name: "분석 및 설계", hasChildren: true, startDate: "2023-06-01", endDate: "2023-06-09" }),
    row({
      id: 2, parentId: 1, depth: 1, name: "요구사항 정의", startDate: "2023-06-01", endDate: "2023-06-09",
      workdays: 6, calendarDays: 9, weight: 100, plannedPercent: 50, actualPercent: 30,
      assignees: [{ id: 5, name: "한도윤" }],
    }),
  ],
  rangeStart: "2023-05-29",
  rangeEnd: "2023-06-16",
  holidays: [{ date: "2023-06-06", name: "현충일" }],
};

vi.mock("../api/wbs", () => ({
  getWbs: vi.fn(() => Promise.resolve(data)),
  createWbsTask: vi.fn(() => Promise.resolve(3)),
  updateWbsTask: vi.fn(() => Promise.resolve()),
  moveWbsTask: vi.fn(() => Promise.resolve()),
  deleteWbsTask: vi.fn(() => Promise.resolve()),
}));
vi.mock("../api/members", () => ({
  listMembers: vi.fn(() => Promise.resolve([{ id: 5, name: "한도윤", active: true }, { id: 6, name: "이재구", active: true }])),
}));
vi.mock("../api/live", () => ({ LIVE_TOPICS: { wbs: "wbs" }, useLiveRefresh: vi.fn() }));

function renderBoard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <WbsBoard documentId={7} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("WbsBoard", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("작업 줄과 계산값, 담당자를 보여준다", async () => {
    renderBoard();
    expect(await screen.findByDisplayValue("요구사항 정의")).toBeTruthy();
    expect(screen.getByTestId("wbs-summary").textContent).toContain("100.0");
    expect(screen.getByText("한도윤")).toBeTruthy();
    expect(screen.getByTestId("wbs-row-2").textContent).toContain("50.0%");
  });

  it("직접 입력하는 열을 앞에, 계산되는 열을 뒤에 둔다", async () => {
    renderBoard();
    await screen.findByDisplayValue("요구사항 정의");
    // 작업 메뉴는 작업명 앞
    const menu = screen.getByLabelText("요구사항 정의 메뉴");
    const name = screen.getByDisplayValue("요구사항 정의");
    expect(menu.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const order = ["작업명", "담당자", "시작", "완료", "실적(개별)", "작업일", "기간", "가중치", "계획(개별)", "계획(전체)", "실적(전체)"];
    const headers = order.map((label) => screen.getAllByText((_, el) => el?.textContent === label && el.children.length <= 1)[0]);
    const positions = headers.map((el) => Array.from(document.querySelectorAll("*")).indexOf(el));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("작업명을 고치고 포커스를 옮기면 전체 값을 저장한다", async () => {
    renderBoard();
    const input = await screen.findByDisplayValue("요구사항 정의");
    fireEvent.change(input, { target: { value: "요구사항 정의서" } });
    fireEvent.blur(input);
    await waitFor(() => expect(updateWbsTask).toHaveBeenCalledWith(2, {
      name: "요구사항 정의서", startDate: "2023-06-01", endDate: "2023-06-09", progress: 30, assigneeIds: [5],
    }));
  });

  it("맨 아래 빈 줄에 작업명을 입력하고 Enter를 누르면 그 이름으로 새 작업을 만들고 칸을 비운다", async () => {
    renderBoard();
    const input = await screen.findByLabelText("새 작업명");
    fireEvent.change(input, { target: { value: "착수보고" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(createWbsTask).toHaveBeenCalledWith(7, null));
    await waitFor(() => expect(updateWbsTask).toHaveBeenCalledWith(3, {
      name: "착수보고", startDate: null, endDate: null, progress: 0, assigneeIds: [],
    }));
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("빈 줄을 비운 채 벗어나면 작업을 만들지 않는다", async () => {
    renderBoard();
    const input = await screen.findByLabelText("새 작업명");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(createWbsTask).not.toHaveBeenCalled();
  });

  it("하위 작업이 있는 작업은 날짜를 입력 칸 없이 계산값으로만 보여준다", async () => {
    renderBoard();
    await screen.findByDisplayValue("분석 및 설계");
    expect(screen.queryByLabelText("분석 및 설계 시작일")).toBeNull();
    expect(screen.getByLabelText("요구사항 정의 시작일")).toBeTruthy();
  });

  it("⋯ 메뉴의 아래에 작업 추가는 같은 상위의 바로 다음 순서로 만든다", async () => {
    renderBoard();
    fireEvent.click(await screen.findByLabelText("요구사항 정의 메뉴"));
    fireEvent.click(await screen.findByText("아래에 작업 추가"));
    await waitFor(() => expect(createWbsTask).toHaveBeenCalledWith(7, 1, 1));
  });

  it("⋯ 메뉴의 하위 작업 추가는 그 작업 아래 맨 끝에 만든다", async () => {
    renderBoard();
    fireEvent.click(await screen.findByLabelText("분석 및 설계 메뉴"));
    fireEvent.click(await screen.findByText("하위 작업 추가"));
    await waitFor(() => expect(createWbsTask).toHaveBeenCalledWith(7, 1, undefined));
  });

  it("작업 삭제는 확인 창에서 확정해야 호출한다", async () => {
    renderBoard();
    fireEvent.click(await screen.findByLabelText("분석 및 설계 메뉴"));
    fireEvent.click(await screen.findByText("작업 삭제"));
    expect(await screen.findByText(/하위 작업도 함께 삭제되며/)).toBeTruthy();
    expect(deleteWbsTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteWbsTask).toHaveBeenCalledWith(1));
  });

  it("기준일을 바꾸면 그 날짜로 다시 조회한다", async () => {
    renderBoard();
    const base = await screen.findByLabelText("기준일");
    fireEvent.change(base, { target: { value: "2023-06-09" } });
    await waitFor(() => expect(getWbs).toHaveBeenCalledWith(7, "2023-06-09"));
  });

  it("간트 막대는 범위 시작일부터의 날짜 칸 위치에 그리고 기준일 세로선을 긋는다", async () => {
    renderBoard();
    const bar = await screen.findByTestId("wbs-bar-2");
    // 5/29 → 6/1은 3칸, 6/1~6/9는 9칸 (칸 폭 22px)
    expect(bar.style.left).toBe("66px");
    expect(bar.style.width).toBe("198px");
    expect(screen.getByTestId("wbs-base-line")).toBeTruthy();
  });

  it("간트 막대는 처음 그릴 때 위 줄부터 차례로 자라나도록 줄 순서를 넘긴다", async () => {
    renderBoard();
    const bar = await screen.findByTestId("wbs-bar-2");
    expect(bar.classList.contains("wbs-bar")).toBe(true);
    // 전체 합계 줄이 0번, 작업 줄은 그 아래부터
    expect(Number(bar.parentElement!.style.getPropertyValue("--bar-order"))).toBeGreaterThan(0);
    expect(screen.getByTestId("wbs-bar-summary").parentElement!.style.getPropertyValue("--bar-order")).toBe("0");
  });

  // jsdom은 배치를 계산하지 않아 줄마다 높이 36px로 위에서부터 쌓인 위치를 넣고,
  // 끌기 이벤트는 마우스 위치를 받지 않아 직접 넣어서 발생
  const dragAt = (type: "dragOver" | "drop", clientX: number, clientY: number) => {
    const list = screen.getByTestId("wbs-task-list");
    list.getBoundingClientRect = () => ({ top: 0, left: 0, height: 108, bottom: 108, right: 900, width: 900 }) as DOMRect;
    list.querySelectorAll(".wbs-row").forEach((rowEl, i) => {
      rowEl.getBoundingClientRect = () => ({ top: i * 36, height: 36, bottom: i * 36 + 36, left: 0, right: 900, width: 900 }) as DOMRect;
    });
    const event = createEvent[type](list, { dataTransfer: { setData: vi.fn(), clearData: vi.fn(), effectAllowed: "", dropEffect: "" } });
    Object.defineProperty(event, "clientX", { value: clientX });
    Object.defineProperty(event, "clientY", { value: clientY });
    fireEvent(list, event);
  };

  const startDrag = (name: string) => fireEvent.dragStart(screen.getByLabelText(`${name} 끌어서 순서 변경`),
    { dataTransfer: { clearData: vi.fn(), setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" } });

  it("줄 위를 정확히 짚지 않아도 가장 가까운 줄 사이에 가로선을 보이고 그 위치로 옮긴다", async () => {
    renderBoard();
    await screen.findByDisplayValue("요구사항 정의");
    startDrag("요구사항 정의");
    // 첫 줄 가운데보다 위 → 맨 앞, 작업명 시작 위치(36px)라 최상위
    dragAt("dragOver", 36, 2);
    expect(screen.getByTestId("wbs-drop-line").getAttribute("data-depth")).toBe("0");
    dragAt("drop", 36, 2);
    await waitFor(() => expect(moveWbsTask).toHaveBeenCalledWith(2, null, 0));
  });

  it("오른쪽으로 끌면 가로선이 들여 써지고 윗줄의 하위 작업으로 넣는다", async () => {
    renderBoard();
    await screen.findByDisplayValue("요구사항 정의");
    startDrag("요구사항 정의");
    // 분석 및 설계 아래, 한 단계(16px) 이상 오른쪽
    dragAt("dragOver", 60, 30);
    expect(screen.getByTestId("wbs-drop-line").getAttribute("data-depth")).toBe("1");
    dragAt("drop", 60, 30);
    await waitFor(() => expect(moveWbsTask).toHaveBeenCalledWith(2, 1, 0));
  });

  it("왼쪽으로 끌면 상위 단계로 꺼낸다", async () => {
    renderBoard();
    await screen.findByDisplayValue("요구사항 정의");
    startDrag("요구사항 정의");
    dragAt("drop", 36, 30);
    await waitFor(() => expect(moveWbsTask).toHaveBeenCalledWith(2, null, 1));
  });
});
