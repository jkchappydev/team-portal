import ExcelJS from "exceljs";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDocument } from "../api/documents";
import { FilePage } from "./FilePage";

vi.mock("../api/documents", () => ({ getDocument: vi.fn() }));
vi.mock("../api/spaces", () => ({ listSpaces: vi.fn(() => Promise.resolve([])) }));
vi.mock("../api/notifications", () => ({ markDocumentRead: vi.fn(() => Promise.resolve()) }));

const fileDetail = (title: string) => ({
  id: 15, spaceId: 1, spaceName: "양식", title, icon: "📊", createdByName: "홍길동", updatedByName: "홍길동",
  updatedAt: "2026-11-05T00:00:00Z", home: false, parentId: null, path: [], kind: "FILE",
  fileUrl: "/api/attachments/30/download",
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/files/15"]}>
          <Routes>
            <Route path="/files/:documentId" element={<FilePage />} />
            <Route path="/documents/:documentId" element={<div>페이지 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("FilePage", () => {
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
    // jsdom에는 없는 크기 감시 기능 (스크롤 영역이 사용)
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("엑셀 양식을 받아 시트 내용을 표로 보여주고 다운로드 버튼을 둔다", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("품의서");
    sheet.getCell("A1").value = "품 의 서";
    sheet.getCell("A2").value = "기안자";
    const buffer = await workbook.xlsx.writeBuffer();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(buffer as ArrayBuffer))));
    vi.mocked(getDocument).mockResolvedValue(fileDetail("품의서.xlsx") as never);

    renderPage();

    expect(await screen.findByText("품 의 서", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText("기안자")).toBeTruthy();
    const download = screen.getByText("다운로드").closest("a")!;
    expect(download.getAttribute("href")).toBe("/api/attachments/30/download");
    expect(download.getAttribute("download")).toBe("품의서.xlsx");
  });

  it("미리보기를 지원하지 않는 형식은 안내만 하고 파일을 받지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getDocument).mockResolvedValue(fileDetail("보고서.hwp") as never);

    renderPage();

    expect(await screen.findByText("미리보기 없음")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("페이지 주소로 들어오면 페이지 화면으로 보낸다", async () => {
    vi.mocked(getDocument).mockResolvedValue({ ...fileDetail("배포 절차"), kind: "PAGE", fileUrl: null } as never);

    renderPage();

    expect(await screen.findByText("페이지 화면")).toBeTruthy();
  });
});
