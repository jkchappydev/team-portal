import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { getDocument } from "../../api/documents";
import type { DocumentDetailDto } from "../../api/documents";
import { PageBlockView } from "./PageBlockView";

vi.mock("../../api/documents", () => ({ getDocument: vi.fn() }));

const page = (over: Partial<DocumentDetailDto>): DocumentDetailDto => ({
  id: 9, spaceId: 1, spaceName: "개발", title: "배포 절차", icon: "📘", cover: null, createdByName: null, updatedByName: null,
  updatedAt: "", home: false, parentId: null, path: [], kind: "PAGE", fileUrl: null, ...over,
});

function renderBlock(documentId: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/spaces/1"]}>
          <Routes>
            <Route path="/spaces/1" element={<PageBlockView documentId={documentId} />} />
            <Route path="/documents/:id" element={<div>페이지 화면</div>} />
            <Route path="/files/:id" element={<div>파일 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("PageBlockView", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it("가리키는 페이지의 아이콘과 제목을 보여 주고 누르면 그 페이지로 간다", async () => {
    vi.mocked(getDocument).mockResolvedValue(page({}));
    renderBlock(9);
    const link = await screen.findByRole("link", { name: /배포 절차/ });
    expect(link.textContent).toContain("📘");
    fireEvent.click(link);
    expect(await screen.findByText("페이지 화면")).toBeTruthy();
  });

  it("파일 항목을 가리키면 파일 화면으로 간다", async () => {
    vi.mocked(getDocument).mockResolvedValue(page({ kind: "FILE", title: "견적서.pdf", icon: null }));
    renderBlock(9);
    fireEvent.click(await screen.findByRole("link", { name: /견적서\.pdf/ }));
    expect(await screen.findByText("파일 화면")).toBeTruthy();
  });

  it("휴지통에 있거나 없는 페이지면 회색 안내만 보이고 링크는 없다", async () => {
    vi.mocked(getDocument).mockRejectedValue(new ApiError("NOT_FOUND", "", 404));
    renderBlock(9);
    expect(await screen.findByText("삭제되었거나 없는 페이지입니다.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
