import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AnnualLeaveTable } from "./AnnualLeaveTable";
import { updateAnnualLeave } from "../api/annualLeaves";

vi.mock("../api/annualLeaves", () => ({
  listAnnualLeaves: () => Promise.resolve([{
    memberId: 1,
    memberName: "홍길동",
    confirmedDays: 15,
    carriedDays: 1,
    totalDays: 16,
    usedDays: 2.75,
    remainingDays: 13.25,
    weeklyUsages: [{ month: 11, week: 2, days: 1.75 }, { month: 3, week: 1, days: 1 }, { month: 5, week: 3, days: 0.25 }],
  }]),
  updateAnnualLeave: vi.fn(() => Promise.resolve({})),
}));

describe("AnnualLeaveTable", () => {
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
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  function renderTable() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <AnnualLeaveTable year={2026} />
        </QueryClientProvider>
      </MantineProvider>,
    );
  }

  it("연차 사용량과 남은 연차를 표시한다", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <AnnualLeaveTable year={2026} />
        </QueryClientProvider>
      </MantineProvider>,
    );

    expect(await screen.findByText("홍길동")).toBeTruthy();
    expect(screen.getByText("2.75")).toBeTruthy();
    // 월·주 칸에 사용 일수 표시
    expect(screen.getByTestId("usage-1-11-2").textContent).toBe("1.75");
    expect(screen.getByTestId("usage-1-3-1").textContent).toBe("1");
    expect(screen.getByTestId("usage-1-3-2").textContent).toBe("");
    expect(screen.getByText("12월")).toBeTruthy();
    expect(screen.getByText("13.25")).toBeTruthy();
    expect(screen.getByText("연차 1일 · 반차 0.5일 · 반반차 0.25일 · 주는 월요일 시작 달력 기준")).toBeTruthy();
  });

  it("주 번호에 마우스를 올리면 해당 주의 월~금 날짜 범위를 보여준다", async () => {
    renderTable();
    expect(await screen.findByText("홍길동")).toBeTruthy();
    fireEvent.mouseEnter(screen.getByTestId("week-head-11-1"));
    expect(await screen.findByText("11/2(월) ~ 11/6(금)")).toBeTruthy();
  });

  it("1 미만 사용 일수도 0.25처럼 앞자리 0을 붙여 표시한다", async () => {
    renderTable();
    expect(await screen.findByText("홍길동")).toBeTruthy();
    // 1 미만 값도 앞자리 0을 생략하지 않음
    expect(screen.getByTestId("usage-1-5-3").textContent).toBe("0.25");
  });

  it("확정 연차를 바꾸고 포커스를 옮기면 바로 저장한다", async () => {
    renderTable();
    const input = await screen.findByLabelText("홍길동 확정 연차");
    fireEvent.change(input, { target: { value: "16" } });
    fireEvent.blur(input);
    await waitFor(() => expect(updateAnnualLeave).toHaveBeenCalledWith(1, 2026, { confirmedDays: 16, carriedDays: 1 }));
  });
});
