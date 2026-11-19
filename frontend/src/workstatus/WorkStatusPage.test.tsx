import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listHolidays } from "../api/holidays";
import { listWorkStatuses } from "../api/workStatuses";
import { WorkStatusPage } from "./WorkStatusPage";

vi.mock("../api/holidays", () => ({ listHolidays: vi.fn() }));
vi.mock("../api/workStatuses", () => ({ listWorkStatuses: vi.fn() }));
vi.mock("../api/live", () => ({ LIVE_TOPICS: { workStatus: "work-status" }, useLiveRefresh: () => {} }));
vi.mock("../user/currentUser", () => ({ useCurrentUser: () => ({ user: { id: 1, name: "가상 팀원", admin: false } }) }));
vi.mock("./AnnualLeaveTable", () => ({ AnnualLeaveTable: () => null }));
// 등록·수정 창은 열린 상태와 날짜·수정 대상만 확인
vi.mock("./WorkStatusForm", () => ({
  WorkStatusForm: (props: { opened: boolean; defaultDate: string; editing: { id: number } | null }) => (
    props.opened ? <p>{props.editing ? `수정 ${props.editing.id}` : `등록 ${props.defaultDate}`}</p> : null
  ),
}));

describe("근무 상황표 좁은 화면", () => {
  const originalMatchMedia = window.matchMedia;
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 19, 9, 0));
    // 좁은 화면(sm 미만)으로 보이게 함
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    vi.mocked(listHolidays).mockResolvedValue([]);
    vi.mocked(listWorkStatuses).mockResolvedValue([
      { id: 7, memberId: 1, memberName: "가상 팀원", type: "LEAVE", startDate: "2026-11-19", endDate: "2026-11-19",
        halfDayPeriod: null, startTime: null, endTime: null, place: null, content: null, label: "가상 팀원 연차" },
      { id: 8, memberId: 2, memberName: "다른 팀원", type: "OUTSIDE_WORK", startDate: "2026-11-20", endDate: "2026-11-20",
        halfDayPeriod: null, startTime: null, endTime: null, place: "출판사", content: null, label: "다른 팀원 외근" },
    ]);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/work-status"]}><WorkStatusPage /></MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("달력 대신 날짜별 목록으로 주말을 포함한 그 달의 모든 날이 보인다", async () => {
    renderPage();
    expect(await screen.findByText("가상 팀원 연차")).toBeTruthy();
    expect(screen.getByLabelText("날짜별 근무 상황")).toBeTruthy();
    // 11월 30일 전부 (토요일 21일 포함)
    expect(document.querySelectorAll("[data-testid^='ws-day-']")).toHaveLength(30);
    expect(screen.getByTestId("ws-day-2026-11-21")).toBeTruthy();
    expect(screen.getByTestId("ws-day-2026-11-19").hasAttribute("data-today")).toBe(true);
  });

  it("날짜 줄을 누르면 그 날로 등록, 내 칩은 수정, 다른 팀원 칩은 아무것도 열지 않는다", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("다른 팀원 외근"));
    expect(screen.queryByText(/^(등록|수정) /)).toBeNull();
    fireEvent.click(screen.getByText("가상 팀원 연차"));
    expect(screen.getByText("수정 7")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ws-day-2026-11-24"));
    expect(screen.getByText("등록 2026-11-24")).toBeTruthy();
  });
});
