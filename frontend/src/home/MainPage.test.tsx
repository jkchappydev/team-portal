import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listNewCs } from "../api/cs";
import { listRecentDocuments } from "../api/documents";
import { listHolidays } from "../api/holidays";
import { getServerStatuses } from "../api/monitor";
import { listSpaces } from "../api/spaces";
import { listWorkStatuses } from "../api/workStatuses";
import { MainPage } from "./MainPage";
import { thisWeekDays } from "./thisWeek";

vi.mock("../api/cs", () => ({ listNewCs: vi.fn() }));
vi.mock("../api/documents", () => ({ listRecentDocuments: vi.fn() }));
vi.mock("../api/holidays", () => ({ listHolidays: vi.fn() }));
vi.mock("../api/monitor", () => ({ getServerStatuses: vi.fn() }));
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
    vi.mocked(getServerStatuses).mockResolvedValue([{ available: true, serverName: "포털 서버", osName: "Rocky Linux 8.10 (Green Obsidian)", kernel: "4.18.0-553.el8_10.x86_64",
      cpuPercent: 12, cpuCores: 4, memoryUsedBytes: 8 * 1024 ** 3, memoryTotalBytes: 16 * 1024 ** 3, uptimeSeconds: 3 * 86_400 + 7_200,
      disks: [{ name: "시스템", usedBytes: 95 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 }], checkedAt: new Date().toISOString() }]);
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

  it("최근 CS를 상태·요청자·등록 시각과 함께(담당자 제외) 보여주고 CS 시스템 상세 화면을 새 탭으로 연결한다", async () => {
    const now = new Date().toISOString();
    vi.mocked(listNewCs).mockResolvedValue({ configured: true, items: [
      { id: 3, title: "로그인 오류", groupName: "A기관", requesterName: "홍길동", managerName: null, status: "REQS", statusName: "요청",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=3" },
      { id: 2, title: "계정 초기화", groupName: "A기관", requesterName: "김영희", managerName: "이철수", status: "COMP", statusName: "완료",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=2" },
    ] });
    renderPage();
    const panel = screen.getByRole("region", { name: "신규 CS" });
    const link = (await within(panel).findByText("로그인 오류")).closest("a")!;
    expect(link.getAttribute("href")).toBe("https://cs.example.com/detail?boardKey=3");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(within(link).getByText("요청")).toBeTruthy();
    expect(within(link).getByText("홍길동 · 방금 전")).toBeTruthy();
    const done = within(panel).getByText("계정 초기화").closest("a")!;
    expect(within(done).getByText("완료")).toBeTruthy();
    expect(within(done).getByText("김영희 · 방금 전")).toBeTruthy();
  });

  it("요청 상태(새로 접수된) CS에만 N 표시를 붙인다", async () => {
    const now = new Date().toISOString();
    vi.mocked(listNewCs).mockResolvedValue({ configured: true, items: [
      { id: 3, title: "새 문의", groupName: null, requesterName: "홍길동", managerName: null, status: "REQS", statusName: "요청",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=3" },
      { id: 2, title: "진행 문의", groupName: null, requesterName: "홍길동", managerName: "이철수", status: "PROG", statusName: "진행중",
        createdAt: now, detailUrl: "https://cs.example.com/detail?boardKey=2" },
    ] });
    renderPage();
    const panel = screen.getByRole("region", { name: "신규 CS" });
    expect(within((await within(panel).findByText("새 문의")).closest("a")!).getByAltText("새로 접수된 CS")).toBeTruthy();
    expect(within(within(panel).getByText("진행 문의").closest("a")!).queryByAltText("새로 접수된 CS")).toBeNull();
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

  it("주간보고는 영역만 잡아 둔다", async () => {
    renderPage();
    expect(within(screen.getByRole("region", { name: "이번 주 주간보고" })).getByText("준비 중입니다.")).toBeTruthy();
  });

  it("모니터링에 서버 CPU·메모리·디스크 사용률을 계기판으로, 가동 시간과 함께 보여준다", async () => {
    renderPage();
    const panel = screen.getByRole("region", { name: "모니터링" });
    expect(await within(panel).findByText("포털 서버")).toBeTruthy();
    expect(within(panel).getByText("가동 3일 2시간")).toBeTruthy();
    expect(within(panel).getByText("Rocky Linux 8.10 (Green Obsidian)")).toBeTruthy();
    // CPU·메모리·디스크 계기판이 한 줄로, 바늘 값은 사용률
    const gauges = within(panel).getAllByRole("meter");
    expect(gauges.map((g) => g.getAttribute("aria-label"))).toEqual(["CPU 사용률", "MEMORY 사용률", "DISK 사용률"]);
    expect(gauges.map((g) => g.getAttribute("aria-valuenow"))).toEqual(["12", "50", "95"]);
    expect(within(panel).getByText("4코어")).toBeTruthy();
    expect(within(panel).getByText("8.0GB / 16.0GB")).toBeTruthy();
    expect(within(panel).getByText("95.0GB / 100GB")).toBeTruthy();
  });

  it("디스크가 여럿이면 계기판 이름에 서버 마운트 위치를 붙인다", async () => {
    vi.mocked(getServerStatuses).mockResolvedValue([{ available: true, serverName: "포털 서버", osName: null, kernel: null, cpuPercent: 12, cpuCores: 4,
      memoryUsedBytes: null, memoryTotalBytes: null, uptimeSeconds: null,
      disks: [{ name: "/", usedBytes: 1, totalBytes: 2 }, { name: "/var", usedBytes: 1, totalBytes: 4 }],
      checkedAt: new Date().toISOString() }]);
    renderPage();
    const panel = screen.getByRole("region", { name: "모니터링" });
    expect(await within(panel).findByText("DISK (/)")).toBeTruthy();
    expect(within(panel).getByText("DISK (/var)")).toBeTruthy();
  });

  it("서버가 여럿이면 서버 버튼으로 골라 그 서버의 계기판을 보여준다", async () => {
    const base = { osName: null, kernel: null, cpuCores: 4, memoryUsedBytes: null, memoryTotalBytes: null, uptimeSeconds: null,
      disks: [], checkedAt: new Date().toISOString() };
    vi.mocked(getServerStatuses).mockResolvedValue([
      { ...base, available: true, serverName: "10.0.0.1", cpuPercent: 10 },
      { ...base, available: true, serverName: "10.0.0.2", cpuPercent: 80 },
      { ...base, available: false, serverName: "10.0.0.3", cpuPercent: null },
    ]);
    renderPage();
    const panel = screen.getByRole("region", { name: "모니터링" });
    expect((await within(panel).findAllByRole("meter"))[0].getAttribute("aria-valuenow")).toBe("10");
    fireEvent.click(within(panel).getByText("10.0.0.2"));
    expect(within(panel).getAllByRole("meter")[0].getAttribute("aria-valuenow")).toBe("80");
    fireEvent.click(within(panel).getByText("10.0.0.3"));
    expect(within(panel).getByText("서버 정보를 읽을 수 없습니다.")).toBeTruthy();
  });

  it("서버 정보를 읽을 수 없으면 안내한다", async () => {
    vi.mocked(getServerStatuses).mockResolvedValue([{ available: false, serverName: "포털 서버", osName: null, kernel: null, cpuPercent: null, cpuCores: 4,
      memoryUsedBytes: null, memoryTotalBytes: null, uptimeSeconds: null, disks: [], checkedAt: new Date().toISOString() }]);
    renderPage();
    expect(await within(screen.getByRole("region", { name: "모니터링" })).findByText("서버 정보를 읽을 수 없습니다.")).toBeTruthy();
  });

  it("좁은 화면은 근무 현황을 요일별 한 줄로 보이고 준비 중 칸도 그대로 보인다", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      renderPage();
      const days = thisWeekDays();
      const tuesday = await screen.findByLabelText(`${days[1].month}/${days[1].day} (화)`);
      expect(await within(tuesday).findByText("홍길동 연차")).toBeTruthy();
      // 근무 상황표 목록처럼 날짜 숫자와 요일을 따로 보이고, 빈 날은 비워 둠
      const monday = screen.getByLabelText(`${days[0].month}/${days[0].day} (월)`);
      expect(within(monday).getByText(String(days[0].day))).toBeTruthy();
      expect(within(monday).getByText("월")).toBeTruthy();
      expect(within(monday).queryByText("없음")).toBeNull();
      // 준비 중 칸도 넓은 화면과 같이 보임
      expect(screen.getByRole("region", { name: "이번 주 주간보고" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "모니터링" })).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });
});
