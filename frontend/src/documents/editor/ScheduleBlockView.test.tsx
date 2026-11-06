import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
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

  it("연결된 WBS의 제목, 크게 열기 링크와 일정표를 보여준다", async () => {
    vi.mocked(getDocument).mockResolvedValueOnce({
      id: 9, spaceId: 1, spaceName: "개발", title: "일정", icon: "📊", createdByName: null, updatedByName: null,
      updatedAt: "", home: false, parentId: 3, path: [], kind: "WBS", fileUrl: null,
    });
    renderBlock(9);
    expect(await screen.findByText("일정표 9")).toBeTruthy();
    expect(await screen.findByText("일정")).toBeTruthy();
    expect(screen.getByText("크게 열기").closest("a")!.getAttribute("href")).toBe("/wbs/9");
  });

  it("연결된 WBS가 휴지통에 있거나 없으면 안내만 보여준다", async () => {
    vi.mocked(getDocument).mockRejectedValueOnce(new ApiError("NOT_FOUND", "없음", 404));
    renderBlock(9);
    expect(await screen.findByText("삭제되었거나 없는 일정입니다.")).toBeTruthy();
  });
});
