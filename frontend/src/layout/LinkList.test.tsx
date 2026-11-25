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

const wiki = { id: 1, title: "사내 위키", url: "https://wiki.example.com/home", icon: null, accountInfo: null };

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
    vi.mocked(createLink).mockResolvedValue({ id: 2, title: "디자인 시안", url: "https://figma.com", icon: null, accountInfo: null });
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "링크 추가" }));
    const title = await screen.findByLabelText("링크 제목");
    fireEvent.change(title, { target: { value: " 디자인 시안 " } });
    fireEvent.keyDown(title, { key: "Enter" });
    expect(createLink).not.toHaveBeenCalled();
    const input = screen.getByLabelText("링크 주소");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: " https://figma.com " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(createLink).toHaveBeenCalledWith("https://figma.com", "디자인 시안", null, null));
    await waitFor(() => expect(screen.queryByLabelText("링크 주소")).toBeNull());
  });

  it("아이콘을 고른 링크는 그 아이콘, 없으면 이모지가 아닌 기본 선 아이콘으로 보인다", async () => {
    vi.mocked(listLinks).mockResolvedValue([wiki, { id: 2, title: "디자인 시안", url: "https://figma.com", icon: "🎨", accountInfo: null }]);
    renderList();
    const designRow = (await screen.findByText("디자인 시안")).closest("a")!;
    const wikiRow = screen.getByText("사내 위키").closest("a")!;
    expect(designRow.textContent).toContain("🎨");
    expect(designRow.querySelector("svg.sidebar-menu-icon")).toBeNull();
    expect(wikiRow.textContent).not.toContain("🔗");
    expect(wikiRow.querySelector("svg.sidebar-menu-icon")).toBeTruthy();
  });

  it("링크 추가 창 제목 칸 앞에서 아이콘을 고를 수 있다 (선택값)", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "링크 추가" }));
    expect(await screen.findByRole("button", { name: "링크 아이콘 선택" })).toBeTruthy();
  });

  it("제목을 비워 두면 추가하지 않는다", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "링크 추가" }));
    const input = await screen.findByLabelText("링크 주소");
    fireEvent.change(input, { target: { value: "https://figma.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: "추가" }).hasAttribute("disabled")).toBe(true);
    expect(createLink).not.toHaveBeenCalled();
  });

  it("웹 주소가 아니면 팝업에 안내를 보여준다", async () => {
    vi.mocked(createLink).mockRejectedValue(new ApiError("INVALID_INPUT", "", 400));
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "링크 추가" }));
    fireEvent.change(await screen.findByLabelText("링크 제목"), { target: { value: "스크립트" } });
    const input = screen.getByLabelText("링크 주소");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("웹 주소(http, https)만 쓸 수 있습니다.")).toBeTruthy();
  });

  it("링크 추가 창 주소 아래에 계정 정보를 넣을 수 있고, 비워 두면 없음으로 저장한다", async () => {
    vi.mocked(createLink).mockResolvedValue({ id: 2, title: "젠킨스", url: "https://ci.example.com", icon: null, accountInfo: null });
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "링크 추가" }));
    fireEvent.change(await screen.findByLabelText("링크 제목"), { target: { value: "젠킨스" } });
    fireEvent.change(screen.getByLabelText("링크 주소"), { target: { value: "https://ci.example.com" } });
    const account = screen.getByLabelText("계정 정보");
    fireEvent.change(account, { target: { value: "  아이디 admin\n비밀번호 1234  " } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(createLink).toHaveBeenCalledWith("https://ci.example.com", "젠킨스", null, "아이디 admin\n비밀번호 1234"));
  });

  it("계정 정보가 있는 링크를 누르면 링크 이동·계정 정보 팝업이 뜨고, 링크 이동은 새 탭으로 연다", async () => {
    vi.mocked(listLinks).mockResolvedValue([{ id: 3, title: "젠킨스", url: "https://ci.example.com", icon: null, accountInfo: "아이디 admin\n비밀번호 1234" }]);
    renderList();
    const row = (await screen.findByText("젠킨스")).closest("a")!;
    // 기본 동작(새 탭 열기)을 막고 팝업을 띄움
    expect(fireEvent.click(row)).toBe(false);
    const go = await screen.findByRole("link", { name: "링크 이동" });
    expect(go.getAttribute("href")).toBe("https://ci.example.com");
    expect(go.getAttribute("target")).toBe("_blank");
    expect(go.getAttribute("rel")).toContain("noopener");
    expect(screen.getByLabelText("계정 정보 내용").textContent).toBe("아이디 admin\n비밀번호 1234");
    fireEvent.click(go);
    await waitFor(() => expect(screen.queryByLabelText("계정 정보 내용")).toBeNull());
  });

  it("계정 정보가 없는 링크도 팝업을 띄우고, 계정 정보 칸은 없다고 안내하며 복사 버튼은 숨긴다", async () => {
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    // 바로 새 탭으로 열지 않음 (기본 동작 막음)
    expect(fireEvent.click(row)).toBe(false);
    expect(await screen.findByRole("link", { name: "링크 이동" })).toBeTruthy();
    expect(screen.getByText("등록된 계정 정보가 없습니다.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "복사" })).toBeNull();
  });

  it("Ctrl을 누르고 클릭하면 팝업 없이 바로 새 탭으로 연다", async () => {
    renderList();
    const row = (await screen.findByText("사내 위키")).closest("a")!;
    expect(fireEvent.click(row, { ctrlKey: true })).toBe(true);
    expect(screen.queryByRole("link", { name: "링크 이동" })).toBeNull();
  });

  it("링크 수정은 추가와 같은 팝업에 기존 값을 채워 열고, 제목·주소·계정 정보를 함께 저장한다", async () => {
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
    expect((screen.getByLabelText("계정 정보") as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("계정 정보"), { target: { value: "아이디 admin" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateLink).toHaveBeenCalledWith(1, "https://team.example.com", "팀 위키", null, "아이디 admin"));
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
