import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { getDocument } from "../../api/documents";
import { ScheduleBlockView } from "./ScheduleBlockView";

vi.mock("../../api/documents", () => ({ getDocument: vi.fn() }));
vi.mock("../../wbs/WbsBoard", () => ({ WbsBoard: ({ documentId }: { documentId: number }) => <div>일정표 {documentId}</div> }));

function renderBlock(documentId: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ScheduleBlockView documentId={documentId} />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("ScheduleBlockView", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(cleanup);

  it("크게 보기는 페이지를 떠나지 않고 전체 화면으로 열고, 작게 보기로 본문 블록 크기로 돌아온다", async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: 9, spaceId: 1, spaceName: "개발", title: "일정", icon: "📊", cover: null, createdByName: null, updatedByName: null,
      updatedAt: "", home: false, parentId: 3, path: [], kind: "WBS", fileUrl: null,
    });
    renderBlock(9);
    expect(await screen.findByText("일정표 9")).toBeTruthy();
    expect(await screen.findByText("일정")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "크게 보기" }));
    expect(await screen.findByRole("button", { name: "작게 보기" })).toBeTruthy();
    // 같은 일정표를 두 번 그리지 않음
    expect(screen.getAllByText("일정표 9")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "작게 보기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "작게 보기" })).toBeNull());
    expect(screen.getByText("일정표 9")).toBeTruthy();
  });

  it("연결된 WBS가 휴지통에 있거나 없으면 안내만 보여준다", async () => {
    vi.mocked(getDocument).mockRejectedValueOnce(new ApiError("NOT_FOUND", "없음", 404));
    renderBlock(9);
    expect(await screen.findByText("삭제되었거나 없는 일정입니다.")).toBeTruthy();
  });
});
