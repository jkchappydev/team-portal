import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { purgeTrashItem, restoreDocument } from "../api/documents";
import { restoreSpace } from "../api/spaces";
import { TrashPage } from "./TrashPage";

vi.mock("../api/documents", () => ({
  getTrash: vi.fn(() => Promise.resolve({
    items: [
      {
        kind: "document", id: 1, name: "상위 페이지", icon: "🎯", deletedAt: "2026-11-04T06:55:00Z",
        children: [
          { id: 2, title: "하위", icon: null, depth: 1 },
          { id: 3, title: "하위의 하위", icon: null, depth: 2 },
        ],
      },
      {
        kind: "space", id: 9, name: "스쿨북스", icon: null, deletedAt: "2026-11-04T02:28:00Z",
        children: [{ id: 20, title: "최상위 안 페이지", icon: null, depth: 1 }],
      },
    ],
  })),
  restoreDocument: vi.fn(() => Promise.resolve()),
  purgeTrashItem: vi.fn(() => Promise.resolve()),
}));
vi.mock("../api/spaces", () => ({ restoreSpace: vi.fn(() => Promise.resolve()) }));

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
  });

  afterEach(cleanup);

  it("최상위 페이지와 하위 페이지를 구분 없이 한 목록으로 보여준다", async () => {
    renderPage();
    expect(await screen.findByText("상위 페이지")).toBeTruthy();
    expect(screen.getByText("스쿨북스")).toBeTruthy();
    expect(screen.queryByText("프로젝트")).toBeNull();
    expect(screen.queryByText("문서")).toBeNull();
  });

  it("함께 숨겨진 하위 페이지를 단계마다 한 칸씩 들여 써서 보여준다", async () => {
    renderPage();
    await screen.findByText("하위");
    expect(screen.getByTestId("trash-child-2").getAttribute("data-depth")).toBe("1");
    expect(screen.getByTestId("trash-child-3").getAttribute("data-depth")).toBe("2");
  });

  it("하위 페이지만 복원하면 그 페이지 ID로 페이지 복원 API를 호출한다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("하위의 하위 복원"));
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith(3));
  });

  it("삭제된 최상위 페이지 안의 페이지는 최상위를 먼저 복원해야 해서 버튼이 비활성이다", async () => {
    renderPage();
    const button = await screen.findByLabelText("최상위 안 페이지 복원");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("종류에 맞는 복원 API를 호출한다", async () => {
    renderPage();
    await screen.findByText("상위 페이지");
    const [pageRestore] = screen.getAllByRole("button", { name: "복원" });
    fireEvent.click(pageRestore);
    await waitFor(() => expect(restoreDocument).toHaveBeenCalledWith(1));
    const spaceRestore = screen.getAllByRole("button", { name: "복원" }).at(-1)!;
    fireEvent.click(spaceRestore);
    await waitFor(() => expect(restoreSpace).toHaveBeenCalledWith(9));
  });

  it("영구 삭제는 확인 창에서 확정해야 종류에 맞는 영구 삭제 API를 호출한다", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("스쿨북스 영구 삭제"));
    expect(await screen.findByText(/되돌릴 수 없습니다/)).toBeTruthy();
    expect(purgeTrashItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "영구 삭제" }));
    await waitFor(() => expect(purgeTrashItem).toHaveBeenCalledWith("space", 9));
  });

  it("영구 삭제 확인 창에서 취소하면 API를 호출하지 않는다", async () => {
    vi.mocked(purgeTrashItem).mockClear();
    renderPage();
    fireEvent.click(await screen.findByLabelText("상위 페이지 영구 삭제"));
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    expect(purgeTrashItem).not.toHaveBeenCalled();
  });
});
