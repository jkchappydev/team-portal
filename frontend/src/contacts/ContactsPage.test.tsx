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
  deleteContact: vi.fn(),
}));

const hong = { id: 1, name: "홍길동", company: "가나출판", email: "hong@example.com", phone: "010-1234-5678", phone2: "02-555-1234", project: "교과서 개발, 전자책", memo: "오전에만 통화 가능", color: "#2f9e44", updatedAt: "2026-11-17T03:00:00Z" };
const kim = { id: 2, name: "김철수", company: "다라인쇄", email: null, phone: null, phone2: null, project: null, memo: null, color: null, updatedAt: "2026-10-02T03:00:00Z" };

describe("ContactsPage", () => {
  beforeAll(() => {
    // 메모 칸 자동 높이(react-textarea-autosize)가 쓰는 글꼴 API가 jsdom에 없어 흉내
    if (!document.fonts) {
      Object.defineProperty(document, "fonts", { value: { addEventListener() {}, removeEventListener() {} }, configurable: true });
    }
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

  it("업체·이메일·전화번호·연관 프로젝트를 명함 카드로 보여주고 이메일·전화는 바로 걸 수 있다", async () => {
    renderPage();
    expect(await screen.findByText("홍길동")).toBeTruthy();
    expect(screen.getByText("가나출판")).toBeTruthy();
    expect(screen.getByText("hong@example.com").closest("a")!.getAttribute("href")).toBe("mailto:hong@example.com");
    expect(screen.getByText("010-1234-5678").closest("a")!.getAttribute("href")).toBe("tel:010-1234-5678");
    expect(screen.getByText("교과서 개발, 전자책")).toBeTruthy();
    // 전화번호 2와 메모도 카드에 보임
    expect(screen.getByText("02-555-1234").closest("a")!.getAttribute("href")).toBe("tel:02-555-1234");
    expect(screen.getByText("오전에만 통화 가능")).toBeTruthy();
    // 카드마다 최종 수정일
    expect(screen.getByText("최종 수정 2026-11-17")).toBeTruthy();
    expect(screen.getByText("최종 수정 2026-10-02")).toBeTruthy();
  });

  it("검색하면 업체·프로젝트·전화번호 숫자로 거른다", async () => {
    renderPage();
    await screen.findByText("홍길동");
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "교과서" } });
    expect(screen.queryByText("김철수")).toBeNull();
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "01012345678" } });
    expect(screen.getByText("홍길동")).toBeTruthy();
    // 전화번호 2 숫자와 메모로도 찾음
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "025551234" } });
    expect(screen.getByText("홍길동")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "통화 가능" } });
    expect(screen.getByText("홍길동")).toBeTruthy();
    expect(screen.queryByText("김철수")).toBeNull();
    fireEvent.change(screen.getByLabelText("연락처 검색"), { target: { value: "없는 업체" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeTruthy();
  });

  it("연락처를 추가하면 빈 항목은 null, 연관 프로젝트는 입력한 글 그대로 보낸다", async () => {
    vi.mocked(createContact).mockResolvedValue({ ...kim, id: 3, name: "이영희" });
    renderPage();
    await screen.findByText("홍길동");
    fireEvent.click(screen.getByRole("button", { name: "+ 연락처 추가" }));
    fireEvent.change(await screen.findByLabelText(/^이름/, { selector: "input" }), { target: { value: " 이영희 " } });
    fireEvent.change(screen.getByLabelText("전화번호 1"), { target: { value: "0212345678" } });
    fireEvent.change(screen.getByLabelText("전화번호 2"), { target: { value: "0311234567" } });
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: " 평일 오후 연락 " } });
    fireEvent.change(screen.getByLabelText("연관 프로젝트"), { target: { value: " 전자책, 교과서 개발 " } });
    // 색을 고름 (다시 누르면 자동으로 돌아가므로 한 번만)
    fireEvent.click(screen.getByLabelText("색 #1971c2"));
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(createContact).toHaveBeenCalledWith({
      name: "이영희", company: null, email: null, phone: "02-1234-5678", phone2: "031-123-4567", project: "전자책, 교과서 개발", memo: "평일 오후 연락", color: "#1971c2",
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
      name: "홍길동", company: "가나출판", project: "교과서 개발, 전자책", color: "#2f9e44",
    })));
  });

  it("처음에는 이름 가나다순이고, 정렬 버튼을 누를 때마다 오름차순·내림차순이 번갈아 바뀐다", async () => {
    renderPage();
    await screen.findByText("홍길동");
    // 카드 순서 (카드마다 ⋯ 메뉴 버튼 이름에 연락처 이름이 들어 있음)
    const names = () => screen.getAllByLabelText(/ 메뉴$/).map((button) => button.getAttribute("aria-label")!.replace(" 메뉴", ""));
    expect(names()).toEqual(["김철수", "홍길동"]);
    expect(screen.queryByText("드래그로 순서를 변경할 수 있습니다.")).toBeNull();
    fireEvent.click(screen.getByLabelText("이름 정렬"));
    expect(names()).toEqual(["홍길동", "김철수"]);
    fireEvent.click(screen.getByLabelText("이름 정렬"));
    expect(names()).toEqual(["김철수", "홍길동"]);
    // 업체 정렬: 가나출판 → 다라인쇄, 다시 누르면 반대
    fireEvent.click(screen.getByLabelText("업체 정렬"));
    expect(names()).toEqual(["홍길동", "김철수"]);
    fireEvent.click(screen.getByLabelText("업체 정렬"));
    expect(names()).toEqual(["김철수", "홍길동"]);
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
