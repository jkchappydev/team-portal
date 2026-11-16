import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createContact, deleteContact, listContacts, updateContact } from "../api/contacts";
import { ContactsPage } from "./ContactsPage";

vi.mock("../api/contacts", () => ({
  CONTACTS_KEY: ["contacts"],
  listContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  moveContact: vi.fn(),
  deleteContact: vi.fn(),
}));

const hong = { id: 1, name: "홍길동", company: "가나출판", email: "hong@example.com", phone: "010-1234-5678", projects: ["교과서 개발"] };
const kim = { id: 2, name: "김철수", company: "다라인쇄", email: null, phone: null, projects: [] };

describe("ContactsPage", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listContacts).mockResolvedValue([hong, kim]);
  });
  afterEach(cleanup);

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MantineProvider><QueryClientProvider client={client}><ContactsPage /></QueryClientProvider></MantineProvider>);
  }

  it("업체·이메일·전화번호·연관 프로젝트를 표로 보여주고 이메일·전화는 바로 걸 수 있다", async () => {
    renderPage();
    expect(await screen.findByText("홍길동")).toBeTruthy();
    expect(screen.getByText("가나출판")).toBeTruthy();
    expect(screen.getByText("hong@example.com").closest("a")!.getAttribute("href")).toBe("mailto:hong@example.com");
    expect(screen.getByText("010-1234-5678").closest("a")!.getAttribute("href")).toBe("tel:010-1234-5678");
    expect(screen.getByText("교과서 개발")).toBeTruthy();
    // 처음에는 이름 가나다순이라 끌기 손잡이가 없음
    expect(screen.queryByLabelText("홍길동 순서 변경")).toBeNull();
  });

  it("검색하면 업체·프로젝트·전화번호 숫자로 거르고 순서 변경 손잡이를 숨긴다", async () => {
    renderPage();
    await screen.findByText("홍길동");
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "교과서" } });
    expect(screen.queryByText("김철수")).toBeNull();
    expect(screen.queryByLabelText("홍길동 순서 변경")).toBeNull();
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "01012345678" } });
    expect(screen.getByText("홍길동")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "없는 업체" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeTruthy();
  });

  it("연락처를 추가하면 빈 항목은 null, 연관 프로젝트는 목록으로 보낸다", async () => {
    vi.mocked(createContact).mockResolvedValue({ ...kim, id: 3, name: "이영희" });
    renderPage();
    await screen.findByText("홍길동");
    fireEvent.click(screen.getByRole("button", { name: "+ 연락처 추가" }));
    fireEvent.change(await screen.findByLabelText(/^이름/, { selector: "input" }), { target: { value: " 이영희 " } });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "0212345678" } });
    const projects = screen.getByLabelText("연관 프로젝트", { selector: "input" });
    // 사용자가 칸을 눌러 입력한 경우만 받으므로 먼저 포커스
    projects.focus();
    fireEvent.change(projects, { target: { value: "전자책" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(createContact).toHaveBeenCalledWith({
      name: "이영희", company: null, email: null, phone: "02-1234-5678", projects: ["전자책"],
    }));
  });

  it("⋯ 메뉴에서 수정 창을 기존 값으로 열고 저장한다", async () => {
    vi.mocked(updateContact).mockResolvedValue(hong);
    renderPage();
    await screen.findByText("홍길동");
    fireEvent.click(screen.getByLabelText("홍길동 메뉴"));
    fireEvent.click(await screen.findByText("연락처 수정"));
    expect((await screen.findByDisplayValue("hong@example.com"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateContact).toHaveBeenCalledWith(1, expect.objectContaining({
      name: "홍길동", company: "가나출판", projects: ["교과서 개발"],
    })));
  });

  it("처음에는 이름 가나다순이고, 머리글을 누르면 내림차순 → 저장 순서(끌기 가능) → 오름차순으로 바뀐다", async () => {
    renderPage();
    await screen.findByText("홍길동");
    const names = () => screen.getAllByRole("row").slice(1).map((row) => row.querySelector("td p")?.textContent);
    expect(names()).toEqual(["김철수", "홍길동"]);
    expect(screen.queryByLabelText("홍길동 순서 변경")).toBeNull();
    fireEvent.click(screen.getByLabelText("이름 정렬"));
    expect(names()).toEqual(["홍길동", "김철수"]);
    // 한 번 더 누르면 끌어서 정한 저장 순서 (손잡이 표시)
    fireEvent.click(screen.getByLabelText("이름 정렬"));
    expect(names()).toEqual(["홍길동", "김철수"]);
    expect(screen.getByLabelText("홍길동 순서 변경").getAttribute("draggable")).toBe("true");
    // 연관 프로젝트가 없는 줄은 내림차순에서도 맨 아래
    fireEvent.click(screen.getByLabelText("연관 프로젝트 정렬"));
    fireEvent.click(screen.getByLabelText("연관 프로젝트 정렬"));
    expect(names()).toEqual(["홍길동", "김철수"]);
  });

  it("삭제는 확인 창을 거친다", async () => {
    vi.mocked(deleteContact).mockResolvedValue();
    renderPage();
    await screen.findByText("홍길동");
    fireEvent.click(screen.getByLabelText("김철수 메뉴"));
    fireEvent.click(await screen.findByText("연락처 삭제"));
    expect(deleteContact).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteContact).toHaveBeenCalledWith(2));
  });
});
