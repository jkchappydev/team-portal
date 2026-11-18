import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listNewCs } from "../api/cs";
import { listRecentDocuments } from "../api/documents";
import { listHolidays } from "../api/holidays";
import { listSpaces } from "../api/spaces";
import { listWorkStatuses } from "../api/workStatuses";
import { MainPage } from "./MainPage";
import { thisWeekDays } from "./thisWeek";

vi.mock("../api/cs", () => ({ listNewCs: vi.fn() }));
vi.mock("../api/documents", () => ({ listRecentDocuments: vi.fn() }));
vi.mock("../api/holidays", () => ({ listHolidays: vi.fn() }));
vi.mock("../api/spaces", () => ({ listSpaces: vi.fn() }));
vi.mock("../api/workStatuses", () => ({ listWorkStatuses: vi.fn() }));

describe("MainPage", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    const days = thisWeekDays();
    vi.mocked(listWorkStatuses).mockResolvedValue([
      { id: 1, memberId: 1, memberName: "홍길동", type: "LEAVE", startDate: days[1].date, endDate: days[1].date, halfDayPeriod: null,
        startTime: null, endTime: null, place: null, content: null, label: "홍길동 연차" },
      { id: 2, memberId: 2, memberName: "김철수", type: "BUSINESS_TRIP", startDate: days[1].date, endDate: days[1].date, halfDayPeriod: null,
        startTime: null, endTime: null, place: "부산", content: null, label: "김철수 출장(부산)" },
    ]);
    vi.mocked(listHolidays).mockResolvedValue([]);
    vi.mocked(listSpaces).mockResolvedValue([]);
    vi.mocked(listRecentDocuments).mockResolvedValue([
      { id: 9, spaceId: 3, spaceName: "개발", title: "배포 절차", icon: null, kind: "PAGE", updatedByName: "이영희", updatedAt: new Date().toISOString() },
    ]);
    vi.mocked(listNewCs).mockResolvedValue({ configured: true, items: [] });
  });
  afterEach(cleanup);

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/main"]}>
            <Routes>
              <Route path="/main" element={<MainPage />} />
              <Route path="/documents/:id" element={<div>문서 화면</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("이번 주 월~금 칸에 연차·출장 등 근무 상황을 보여주고, 빈 날은 없음으로 표시한다", async () => {
    renderPage();
    const days = thisWeekDays();
    const tuesday = await screen.findByLabelText(`${days[1].month}/${days[1].day} (화)`);
    expect(await within(tuesday).findByText("홍길동 연차")).toBeTruthy();
    expect(within(tuesday).getByText("김철수 출장(부산)")).toBeTruthy();
    expect(within(screen.getByLabelText(`${days[0].month}/${days[0].day} (월)`)).getByText("없음")).toBeTruthy();
  });

  it("최근 수정된 게시글을 마지막 수정자와 함께 보여주고 누르면 그 페이지로 간다", async () => {
    renderPage();
    expect(await screen.findByRole("region", { name: "최근 수정된 게시글" })).toBeTruthy();
    const post = await screen.findByText("배포 절차");
    expect(screen.getByText("개발 · 이영희 · 방금 전")).toBeTruthy();
    fireEvent.click(post);
    expect(await screen.findByText("문서 화면")).toBeTruthy();
  });

  it("최근 CS를 상태·요청자·담당자·등록 시각과 함께 보여주고 CS 시스템 상세 화면을 새 탭으로 연결한다", async () => {
    const now = new Date().toISOString();
    vi.mocked(listNewCs).mockResolvedValue({ configured: true, items: [
      { id: 3, title: "로그인 오류", groupName: "A기관", requesterName: "홍길동", managerName: null, status: "REQS", statusName: "요청",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=3" },
      { id: 2, title: "계정 초기화", groupName: "A기관", requesterName: "윤소은", managerName: "구슬기", status: "COMP", statusName: "완료",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=2" },
    ] });
    renderPage();
    const panel = screen.getByRole("region", { name: "신규 CS" });
    const link = (await within(panel).findByText("로그인 오류")).closest("a")!;
    expect(link.getAttribute("href")).toBe("https://cs.example.com/detail?boardKey=3");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(within(link).getByText("요청")).toBeTruthy();
    expect(within(link).getByText("홍길동 · 담당자 미지정 · 방금 전")).toBeTruthy();
    const done = within(panel).getByText("계정 초기화").closest("a")!;
    expect(within(done).getByText("완료")).toBeTruthy();
    expect(within(done).getByText("윤소은 · 구슬기 · 방금 전")).toBeTruthy();
  });

  it("요청 상태(새로 접수된) CS에만 N 표시를 붙인다", async () => {
    const now = new Date().toISOString();
    vi.mocked(listNewCs).mockResolvedValue({ configured: true, items: [
      { id: 3, title: "새 문의", groupName: null, requesterName: "홍길동", managerName: null, status: "REQS", statusName: "요청",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=3" },
      { id: 2, title: "진행 문의", groupName: null, requesterName: "홍길동", managerName: "구슬기", status: "PROG", statusName: "진행중",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=2" },
    ] });
    renderPage();
    const panel = screen.getByRole("region", { name: "신규 CS" });
    expect(within((await within(panel).findByText("새 문의")).closest("a")!).getByLabelText("새로 접수된 CS")).toBeTruthy();
    expect(within(within(panel).getByText("진행 문의").closest("a")!).queryByLabelText("새로 접수된 CS")).toBeNull();
  });

  it("CS가 없으면 없다고 안내한다", async () => {
    renderPage();
    expect(await within(screen.getByRole("region", { name: "신규 CS" })).findByText("등록된 CS가 없습니다.")).toBeTruthy();
  });

  it("CS 연동 설정이 없으면 미설정 안내를 보여준다", async () => {
    vi.mocked(listNewCs).mockResolvedValue({ configured: false, items: [] });
    renderPage();
    expect(await within(screen.getByRole("region", { name: "신규 CS" })).findByText("CS 시스템 연동 설정이 없습니다.")).toBeTruthy();
  });

  it("신규 CS 조회에 실패하면 오류를 보여준다", async () => {
    vi.mocked(listNewCs).mockRejectedValue(new Error("CS 시스템에서 목록을 가져오지 못했습니다."));
    renderPage();
    expect(await within(screen.getByRole("region", { name: "신규 CS" })).findByText("신규 CS를 불러오지 못했습니다.")).toBeTruthy();
  });

  it("주간보고·모니터링은 영역만 잡아 둔다", async () => {
    renderPage();
    expect(within(screen.getByRole("region", { name: "이번 주 주간보고" })).getByText("준비 중입니다.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "모니터링" })).getByText("준비 중입니다.")).toBeTruthy();
  });
});
