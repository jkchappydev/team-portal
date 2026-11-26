import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { purgeTrashItem, restoreDocument } from "../api/documents";
import { restoreSpace } from "../api/spaces";
import { restoreForm } from "../api/forms";
import { TrashPage } from "./TrashPage";
import { attachPageBlock } from "./editor/pageBlockSync";

vi.mock("../api/documents", () => ({
  getTrash: vi.fn(() => Promise.resolve({
    items: [
      {
        kind: "document", id: 1, name: "상위 페이지", icon: "🎯", spaceKind: null, location: "운영 › 회의록", trashedParentId: 40, trashedParent: "회의록 모음",
        deletedAt: "2026-11-04T06:55:00Z",
        children: [
          { id: 2, title: "하위", icon: null, depth: 1 },
          { id: 3, title: "하위의 하위", icon: null, depth: 2 },
        ],
      },
      {
        kind: "space", id: 9, name: "고객 포털", icon: null, spaceKind: "PROJECT", location: "사이드바", trashedParentId: null, trashedParent: null,
        deletedAt: "2026-11-04T02:28:00Z",
        children: [{ id: 20, title: "최상위 안 페이지", icon: null, depth: 1 }],
      },
      {
        kind: "form", id: 7, name: "품의서.xlsx", icon: null, spaceKind: null, location: "공유 보관함", trashedParentId: null, trashedParent: null,
        deletedAt: "2026-11-04T01:00:00Z", children: [],
      },
      // "상위 페이지"보다 나중에 지운 원래 상위 페이지
      {
        kind: "document", id: 40, name: "회의록 모음", icon: null, spaceKind: null, location: "운영", trashedParentId: null,
        trashedParent: null, deletedAt: "2026-11-04T00:30:00Z", children: [],
      },
    ],
  })),
  restoreDocument: vi.fn(() => Promise.resolve()),
  purgeTrashItem: vi.fn(() => Promise.resolve()),
}));
vi.mock("../api/spaces", () => ({ restoreSpace: vi.fn(() => Promise.resolve()) }));
vi.mock("../api/forms", () => ({ FORMS_KEY: ["forms"], restoreForm: vi.fn(() => Promise.resolve()) }));
// 복원한 페이지의 블록을 상위 본문에 다시 붙이는 처리 (협업 서버 접속은 따로 시험)
vi.mock("./editor/pageBlockSync", () => ({ attachPageBlock: vi.fn(() => Promise.resolve()) }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <TrashPage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

// 항목 이름이 있는 표 줄
function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

describe("TrashPage", () => {
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
    // 종류 필터(SegmentedControl)의 선택 표시가 크기 변화를 지켜봄
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    vi.mocked(purgeTrashItem).mockClear();
    vi.mocked(restoreDocument).mockClear();
    vi.mocked(attachPageBlock).mockClear();
    vi.mocked(restoreSpace).mockClear();
    vi.mocked(restoreForm).mockClear();
  });

  afterEach(cleanup);

  it("항목마다 종류와 원래 위치를 보여준다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    expect(within(rowOf("상위 페이지")).getByText("페이지")).toBeTruthy();
    expect(within(rowOf("상위 페이지")).getByText("운영 › 회의록")).toBeTruthy();
    expect(within(rowOf("고객 포털")).getByText("프로젝트")).toBeTruthy();
    expect(within(rowOf("품의서.xlsx")).getByText("파일")).toBeTruthy();
    expect(within(rowOf("품의서.xlsx")).getByText("공유 보관함")).toBeTruthy();
  });

  it("원래 상위 페이지가 휴지통에 있으면 복원 위치를 확인 창으로 알리고, 확인해야 복원한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(within(rowOf("상위 페이지")).getByRole("button", { name: "복원" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(
      "\"상위 페이지\" 페이지는 원래 상위 페이지(회의록 모음)가 휴지통에 있어 \"운영 › 회의록\" 아래로 복원됩니다.",
    )).toBeTruthy();
    expect(restoreDocument).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith(1));
  });

  it("복원 위치 확인 창에서 취소하면 복원하지 않는다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(within(rowOf("상위 페이지")).getByRole("button", { name: "복원" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "취소" }));
    expect(restoreDocument).not.toHaveBeenCalled();
  });

  it("원래 자리로 돌아가는 항목은 확인 창 없이 바로 복원한다", async () => {
    renderPage();
    await screen.findByText("회의록 모음");
    fireEvent.click(within(rowOf("회의록 모음")).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith(40));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("하위 페이지는 접혀 있다가 펼치면 단계마다 한 칸씩 들여 써서 보여준다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    expect(screen.queryByTestId("trash-child-2")).toBeNull();
    expect(within(rowOf("상위 페이지")).getByText("하위 2")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("상위 페이지 하위 페이지 펼치기"));
    expect(screen.getByTestId("trash-child-2").getAttribute("data-depth")).toBe("1");
    expect(screen.getByTestId("trash-child-3").getAttribute("data-depth")).toBe("2");
  });

  it("하위 페이지만 복원하면 들어갈 위치를 확인한 뒤 그 페이지 ID로 페이지 복원 API를 호출한다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("상위 페이지 하위 페이지 펼치기"));
    fireEvent.click(screen.getByLabelText("하위의 하위 복원"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/"하위의 하위" 페이지는 원래 상위 페이지\(상위 페이지\)가 휴지통에 있어 "운영 › 회의록" 아래로/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith(3));
  });

  it("삭제된 프로젝트 안의 페이지는 프로젝트를 먼저 복원해야 해서 버튼이 비활성이다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("고객 포털 하위 페이지 펼치기"));
    const button = screen.getByLabelText("최상위 안 페이지 복원");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("종류에 맞는 복원 API를 호출한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(within(rowOf("회의록 모음")).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith(40));
    fireEvent.click(within(rowOf("고객 포털")).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreSpace).toHaveBeenCalledWith(9));
    fireEvent.click(within(rowOf("품의서.xlsx")).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreForm).toHaveBeenCalledWith(7));
  });

  it("종류 필터와 검색으로 목록을 좁히고, 하위 페이지 제목으로 찾으면 펼쳐서 보여준다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(screen.getByText("프로젝트 1"));
    expect(screen.queryByText("상위 페이지")).toBeNull();
    expect(screen.getByText("고객 포털")).toBeTruthy();

    fireEvent.click(screen.getByText("전체 4"));
    fireEvent.change(screen.getByLabelText("휴지통 검색"), { target: { value: "하위의" } });
    expect(screen.queryByText("품의서.xlsx")).toBeNull();
    expect(screen.getByTestId("trash-child-3")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("휴지통 검색"), { target: { value: "없는 이름" } });
    expect(screen.getByText("조건에 맞는 항목이 없습니다.")).toBeTruthy();
  });

  it("영구 삭제는 확인 창에서 확정해야 종류에 맞는 영구 삭제 API를 호출한다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("고객 포털 영구 삭제"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/되돌릴 수 없습니다/)).toBeTruthy();
    expect(purgeTrashItem).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "영구 삭제" }));
    await waitFor(() => expect(purgeTrashItem).toHaveBeenCalledWith("space", 9));
  });

  it("영구 삭제 확인 창에서 취소하면 API를 호출하지 않는다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("상위 페이지 영구 삭제"));
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    expect(purgeTrashItem).not.toHaveBeenCalled();
  });

  it("공유 보관함 파일 영구 삭제는 파일 문구로 확인한 뒤 form 종류로 지운다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("품의서.xlsx 영구 삭제"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/"품의서.xlsx" 파일을 영구 삭제할까요?/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "영구 삭제" }));
    await waitFor(() => expect(purgeTrashItem).toHaveBeenCalledWith("form", 7));
  });

  it("고른 항목만 한꺼번에 복원하고, 다른 자리로 갈 페이지는 먼저 위치를 확인한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(screen.getByLabelText("상위 페이지 선택"));
    fireEvent.click(screen.getByLabelText("품의서.xlsx 선택"));
    expect(screen.getByText("2개 선택됨")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "선택 복원" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/"상위 페이지" 페이지는 원래 상위 페이지\(회의록 모음\)가 휴지통에 있어/)).toBeTruthy();
    expect(restoreDocument).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restoreForm).toHaveBeenCalledWith(7));
    expect(restoreDocument).toHaveBeenCalledWith(1);
    expect(restoreSpace).not.toHaveBeenCalled();
  });

  it("휴지통 속 상위 페이지를 함께 고르면 확인 창 없이 상위부터 복원해 하위가 원래 자리로 돌아간다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(screen.getByLabelText("상위 페이지 선택"));
    fireEvent.click(screen.getByLabelText("회의록 모음 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 복원" }));
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledTimes(2));
    expect(vi.mocked(restoreDocument).mock.calls).toEqual([[40], [1]]);
    // 복원한 페이지마다 상위 본문에 페이지 블록을 다시 붙임 (상위부터)
    await waitFor(() => expect(vi.mocked(attachPageBlock).mock.calls).toEqual([[40], [1]]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("상위 본문에 블록을 다시 붙이지 못해도 복원은 그대로 끝난다", async () => {
    vi.mocked(attachPageBlock).mockRejectedValueOnce(new Error("접속 실패"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderPage();
    await screen.findByText("회의록 모음");
    fireEvent.click(screen.getByLabelText("회의록 모음 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 복원" }));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(restoreDocument).toHaveBeenCalledWith(40);
    expect(screen.queryByText(/복원하지 못했습니다/)).toBeNull();
    warn.mockRestore();
  });

  it("맨 위 체크박스는 아래 항목이 모두 체크됐을 때만 체크되고, 선택 해제는 체크박스로 한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    const header = screen.getByLabelText("전체 선택") as HTMLInputElement;
    fireEvent.click(screen.getByLabelText("상위 페이지 선택"));
    expect(header.checked).toBe(false);
    expect(screen.getByText("1개 선택됨")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "선택 해제" })).toBeNull();

    fireEvent.click(header);
    expect(header.checked).toBe(true);
    fireEvent.click(screen.getByLabelText("고객 포털 선택"));
    expect(header.checked).toBe(false);

    fireEvent.click(header);
    fireEvent.click(header);
    expect(screen.queryByText(/개 선택됨/)).toBeNull();
  });

  it("고른 항목을 한꺼번에 영구 삭제하기 전에 개수를 확인한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(screen.getByLabelText("전체 선택"));
    fireEvent.click(screen.getByLabelText("고객 포털 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 영구 삭제" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/선택한 항목 3개를 영구 삭제할까요?/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "영구 삭제" }));
    await waitFor(() => expect(purgeTrashItem).toHaveBeenCalledTimes(3));
    expect(purgeTrashItem).toHaveBeenCalledWith("document", 1);
    expect(purgeTrashItem).toHaveBeenCalledWith("form", 7);
  });

  it("휴지통 비우기는 모든 항목을 확인 후 영구 삭제한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    fireEvent.click(screen.getByRole("button", { name: "휴지통 비우기" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/휴지통의 항목 4개를 모두 영구 삭제할까요?/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "영구 삭제" }));
    await waitFor(() => expect(purgeTrashItem).toHaveBeenCalledTimes(4));
  });
});
