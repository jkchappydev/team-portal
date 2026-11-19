import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteForm, listForms, moveForm, uploadForm } from "../api/forms";
import type { FormDto } from "../api/forms";
import { FormsPage } from "./FormsPage";
import { formatFileSize } from "./formFile";

vi.mock("../api/forms", () => ({
  FORMS_KEY: ["forms"],
  listForms: vi.fn(),
  uploadForm: vi.fn(),
  moveForm: vi.fn(),
  deleteForm: vi.fn(),
}));

// 미리보기는 파일 형식별로 따로 시험하므로 여기서는 어떤 파일을 그리는지만 확인
vi.mock("../documents/preview/FilePreview", () => ({
  FilePreview: ({ url, fileName }: { url: string; fileName: string }) => <div data-testid="preview" data-url={url}>{fileName}</div>,
}));

const leave: FormDto = { id: 1, name: "휴가 신청서.hwp", contentType: "application/x-hwp", size: 20480, uploadedByName: "가나다", createdAt: "2026-11-17T03:00:00Z", url: "/api/forms/1/download" };
const expense: FormDto = { id: 2, name: "지출 결의서.pdf", contentType: "application/pdf", size: 1536000, uploadedByName: "라마바", createdAt: "2026-11-18T03:00:00Z", url: "/api/forms/2/download" };

describe("FormsPage", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listForms).mockResolvedValue([leave, expense]);
  });
  afterEach(cleanup);

  function renderPage(path = "/forms") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}><FormsPage /></MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("처음에는 맨 위 양식을 미리보고, 다른 줄을 누르면 그 양식으로 바뀐다", async () => {
    renderPage();
    expect(await screen.findByTestId("preview")).toHaveProperty("textContent", "휴가 신청서.hwp");
    // 미리보기 제목 줄 오른쪽 끝 다운로드는 한글 파일명을 유지해 내려받음
    const download = screen.getByRole("link", { name: "휴가 신청서.hwp 다운로드" });
    expect(download.getAttribute("download")).toBe("휴가 신청서.hwp");
    // 크기와 올린 날짜는 왼쪽 목록 줄에만 (미리보기 제목 줄에는 없음, 올린 사람은 보이지 않음)
    expect(screen.getAllByText("20KB · 2026-11-17").length).toBe(1);
    expect(screen.queryByText(/가나다/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "지출 결의서.pdf" }));
    expect(screen.getByTestId("preview").textContent).toBe("지출 결의서.pdf");
    expect(screen.getByTestId("preview").getAttribute("data-url")).toBe("/api/forms/2/download");
    expect(screen.getByRole("button", { name: "지출 결의서.pdf" }).getAttribute("aria-current")).toBe("true");
  });

  it("주소에 고른 양식이 있으면 그 양식을 미리본다", async () => {
    renderPage("/forms?id=2");
    await waitFor(() => expect(screen.getByTestId("preview").textContent).toBe("지출 결의서.pdf"));
  });

  it("올린 양식이 없으면 안내 문구를 보인다", async () => {
    vi.mocked(listForms).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("올린 파일이 없습니다.")).toBeTruthy();
    expect(screen.getByText("파일을 올리면 여기에서 미리볼 수 있습니다.")).toBeTruthy();
  });

  it("파일을 고르면 고른 순서대로 올리고 마지막에 올린 양식을 미리본다", async () => {
    const fresh: FormDto = { ...leave, id: 3, name: "출장 보고서.docx", url: "/api/forms/3/download" };
    vi.mocked(uploadForm).mockResolvedValueOnce({ ...leave, id: 4 }).mockResolvedValueOnce(fresh);
    renderPage();
    await screen.findByTestId("preview");
    vi.mocked(listForms).mockResolvedValue([leave, expense, fresh]);

    const first = new File(["a"], "a.hwp");
    const second = new File(["b"], "출장 보고서.docx");
    fireEvent.change(screen.getByLabelText("올릴 파일 선택"), { target: { files: [first, second] } });

    await waitFor(() => expect(screen.getByTestId("preview").textContent).toBe("출장 보고서.docx"));
    expect(vi.mocked(uploadForm).mock.calls.map(([file]) => file.name)).toEqual(["a.hwp", "출장 보고서.docx"]);
  });

  it("바깥 파일을 화면에 끌어다 놓으면 올린다", async () => {
    vi.mocked(uploadForm).mockResolvedValue(leave);
    renderPage();
    await screen.findByTestId("preview");
    const file = new File(["a"], "a.xlsx");
    const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" };
    fireEvent.dragOver(screen.getByTestId("form-list"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("form-list"), { dataTransfer });
    await waitFor(() => expect(uploadForm).toHaveBeenCalledWith(file));
  });

  // jsdom은 끌기 이벤트에 커서 높이가 없어 목록 맨 아래로 놓는 경우로 확인
  it("줄을 끌어 맨 아래로 옮기면 그 순서로 저장하고 가로선은 놓을 자리에만 보인다", async () => {
    vi.mocked(moveForm).mockResolvedValue();
    renderPage();
    await screen.findByTestId("preview");
    const rows = screen.getAllByRole("button", { name: /\.(hwp|pdf)$/ }).map((button) => button.closest("[data-form-row]")!);
    const dataTransfer = { types: ["application/x-portal-form"], setData: vi.fn(), effectAllowed: "move", dropEffect: "none" };
    fireEvent.dragStart(rows[0], { dataTransfer });
    fireEvent.dragOver(rows[1], { dataTransfer });
    expect(rows[1].getAttribute("data-drop-position")).toBe("after");
    expect(rows[0].getAttribute("data-drop-position")).toBeNull();
    fireEvent.drop(rows[1], { dataTransfer });
    await waitFor(() => expect(moveForm).toHaveBeenCalledWith(1, 1));
    expect(rows[1].getAttribute("data-drop-position")).toBeNull();
    expect(uploadForm).not.toHaveBeenCalled();
  });

  it("고른 파일을 바꾸면 다운로드도 그 파일을 내려받는다", async () => {
    renderPage();
    await screen.findByTestId("preview");
    fireEvent.click(screen.getByRole("button", { name: "지출 결의서.pdf" }));
    const download = screen.getByRole("link", { name: "지출 결의서.pdf 다운로드" });
    expect(download.getAttribute("href")).toBe("/api/forms/2/download");
    expect(download.getAttribute("download")).toBe("지출 결의서.pdf");
  });

  it("줄의 휴지통 버튼으로 삭제하면 확인 창을 거친다", async () => {
    vi.mocked(deleteForm).mockResolvedValue();
    renderPage();
    await screen.findByTestId("preview");
    // ⋯ 메뉴는 없음
    expect(screen.queryByRole("button", { name: "지출 결의서.pdf 메뉴" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "지출 결의서.pdf 삭제" }));
    const dialog = await screen.findByRole("dialog", { name: "파일 삭제" });
    // 삭제한 파일은 휴지통으로 가므로 "되돌릴 수 없습니다" 안내는 없음
    expect(within(dialog).getByText('"지출 결의서.pdf" 파일을 삭제할까요?')).toBeTruthy();
    expect(within(dialog).queryByText(/되돌릴 수 없습니다/)).toBeNull();
    expect(deleteForm).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteForm).toHaveBeenCalledWith(2));
  });

  it("파일 크기를 읽기 쉬운 단위로 적는다", () => {
    expect(formatFileSize(512)).toBe("512B");
    expect(formatFileSize(20480)).toBe("20KB");
    expect(formatFileSize(1536000)).toBe("1.5MB");
  });
});
