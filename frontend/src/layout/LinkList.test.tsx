import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLink, deleteLink, listLinks, updateLink } from "../api/links";
import { ApiError } from "../api/client";
import { LinkList } from "./LinkList";

vi.mock("../api/links", () => ({
  LINKS_KEY: ["links"],
  listLinks: vi.fn(),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  moveLink: vi.fn(),
  deleteLink: vi.fn(),
}));

const wiki = { id: 1, title: "사내 위키", url: "https://wiki.example.com/home", icon: null };

describe("LinkList", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listLinks).mockResolvedValue([wiki]);
  });
  afterEach(cleanup);

  function renderList() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MantineProvider><QueryClientProvider client={client}><LinkList /></QueryClientProvider></MantineProvider>);
  }

  it("링크는 새 탭으로 열리고 끌 수 있다", async () => {
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    expect(row.getAttribute("href")).toBe("https://wiki.example.com/home");
    expect(row.getAttribute("target")).toBe("_blank");
    expect(row.getAttribute("rel")).toContain("noopener");
    expect(row.getAttribute("draggable")).toBe("true");
  });

  it("링크 추가 팝업에서 제목과 주소를 넣고 Enter를 누르면 추가된다", async () => {
    vi.mocked(createLink).mockResolvedValue({ id: 2, title: "디자인 시안", url: "https://figma.com", icon: null });
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "+ 링크 추가" }));
    const title = await screen.findByLabelText("링크 제목");
    fireEvent.change(title, { target: { value: " 디자인 시안 " } });
    fireEvent.keyDown(title, { key: "Enter" });
    expect(createLink).not.toHaveBeenCalled();
    const input = screen.getByLabelText("링크 주소");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: " https://figma.com " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(createLink).toHaveBeenCalledWith("https://figma.com", "디자인 시안", null));
    await waitFor(() => expect(screen.queryByLabelText("링크 주소")).toBeNull());
  });

  it("아이콘을 고른 링크는 그 아이콘, 없으면 기본 🔗로 보인다", async () => {
    vi.mocked(listLinks).mockResolvedValue([wiki, { id: 2, title: "디자인 시안", url: "https://figma.com", icon: "🎨" }]);
    renderList();
    const designRow = (await screen.findByText("디자인 시안")).closest("a")!;
    const wikiRow = screen.getByText("사내 위키").closest("a")!;
    expect(designRow.textContent).toContain("🎨");
    expect(wikiRow.textContent).toContain("🔗");
  });

  it("링크 추가 창 제목 칸 앞에서 아이콘을 고를 수 있다 (선택값)", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "+ 링크 추가" }));
    expect(await screen.findByRole("button", { name: "링크 아이콘 선택" })).toBeTruthy();
  });

  it("제목을 비워 두면 추가하지 않는다", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "+ 링크 추가" }));
    const input = await screen.findByLabelText("링크 주소");
    fireEvent.change(input, { target: { value: "https://figma.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: "추가" }).hasAttribute("disabled")).toBe(true);
    expect(createLink).not.toHaveBeenCalled();
  });

  it("웹 주소가 아니면 팝업에 안내를 보여준다", async () => {
    vi.mocked(createLink).mockRejectedValue(new ApiError("INVALID_INPUT", "", 400));
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "+ 링크 추가" }));
    fireEvent.change(await screen.findByLabelText("링크 제목"), { target: { value: "스크립트" } });
    const input = screen.getByLabelText("링크 주소");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("웹 주소(http, https)만 쓸 수 있습니다.")).toBeTruthy();
  });

  it("링크 수정은 추가와 같은 팝업에 기존 값을 채워 열고, 제목·주소를 함께 저장한다", async () => {
    vi.mocked(updateLink).mockResolvedValue({ ...wiki, title: "팀 위키", url: "https://team.example.com" });
    // 서버 반영 후 다시 조회하면 바뀐 제목이 옴
    vi.mocked(listLinks).mockResolvedValueOnce([wiki]).mockResolvedValue([{ ...wiki, title: "팀 위키" }]);
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    fireEvent.mouseEnter(row);
    fireEvent.click(screen.getByLabelText("사내 위키 메뉴"));
    fireEvent.click(await screen.findByText("링크 수정"));
    expect(await screen.findByText("링크 수정", { selector: "p" })).toBeTruthy();
    const title = screen.getByLabelText("링크 제목") as HTMLInputElement;
    const url = screen.getByLabelText("링크 주소") as HTMLInputElement;
    expect(title.value).toBe("사내 위키");
    expect(url.value).toBe("https://wiki.example.com/home");
    fireEvent.change(title, { target: { value: "팀 위키" } });
    fireEvent.change(url, { target: { value: "https://team.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateLink).toHaveBeenCalledWith(1, "https://team.example.com", "팀 위키", null));
    expect(await screen.findByText("팀 위키")).toBeTruthy();
  });

  it("링크 수정 팝업에서 취소하면 바꾸지 않는다", async () => {
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    fireEvent.mouseEnter(row);
    fireEvent.click(screen.getByLabelText("사내 위키 메뉴"));
    fireEvent.click(await screen.findByText("링크 수정"));
    fireEvent.change(await screen.findByLabelText("링크 제목"), { target: { value: "다른 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(await screen.findByText("사내 위키")).toBeTruthy();
    expect(updateLink).not.toHaveBeenCalled();
  });

  it("삭제는 확인 창을 거친다", async () => {
    vi.mocked(deleteLink).mockResolvedValue(undefined);
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    fireEvent.keyDown(row, { key: "Delete" });
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteLink).toHaveBeenCalled());
  });

  it("⋯ 메뉴의 링크 삭제도 확인 창을 연다", async () => {
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    fireEvent.mouseEnter(row);
    fireEvent.click(screen.getByLabelText("사내 위키 메뉴"));
    fireEvent.click(await screen.findByText("링크 삭제"));
    expect(await screen.findByText(/링크를 삭제할까요/)).toBeTruthy();
  });
});
