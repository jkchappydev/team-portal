import { describe, expect, it } from "vitest";
import type { WorkStatusDto } from "../api/workStatuses";
import { buildMonthGrid, expandToWeekdays, leaveWeekRangeLabel } from "./calendar";

function item(id: number, startDate: string, endDate: string): WorkStatusDto {
  return {
    id, memberId: 1, memberName: "홍길동", type: "BUSINESS_TRIP", startDate, endDate,
    halfDayPeriod: null, startTime: null, endTime: null, place: "일본", content: null, label: `항목${id}`,
  };
}

describe("buildMonthGrid", () => {
  it("2026-11은 일요일 시작, 1일(일)이 첫 칸이고 토요일 11/7은 weekend", () => {
    const grid = buildMonthGrid(2026, 11);
    expect(grid[0][0]).toEqual({ date: "2026-11-01", inMonth: true, weekend: true });
    expect(grid[0][6]).toEqual({ date: "2026-11-07", inMonth: true, weekend: true });
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.at(-1)!.at(-1)!.date).toBe("2026-12-05");
  });

  it("2026-10은 앞 달 9/27(일)부터 시작한다", () => {
    const grid = buildMonthGrid(2026, 10);
    expect(grid[0][0]).toEqual({ date: "2026-09-27", inMonth: false, weekend: true });
    expect(grid[0][4].date).toBe("2026-10-01");
  });
});

describe("expandToWeekdays", () => {
  it("expandToWeekdays_skipsWeekends", () => {
    const map = expandToWeekdays([item(1, "2026-11-11", "2026-11-17")], 2026, 11);
    expect([...map.keys()].sort()).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"]);
  });

  it("expandToWeekdays_clipsToMonth", () => {
    const map = expandToWeekdays([item(1, "2026-10-30", "2026-11-03")], 2026, 11);
    expect([...map.keys()].sort()).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("같은 날 여러 항목은 입력 순서를 유지", () => {
    const map = expandToWeekdays([item(2, "2026-11-04", "2026-11-04"), item(1, "2026-11-04", "2026-11-05")], 2026, 11);
    expect(map.get("2026-11-04")!.map((i) => i.id)).toEqual([2, 1]);
  });
});

describe("leaveWeekRangeLabel", () => {
  it("1일이 일요일인 2026-11의 1주는 11/2(월) ~ 11/6(금)", () => {
    expect(leaveWeekRangeLabel(2026, 11, 1)).toBe("11/2(월) ~ 11/6(금)");
    expect(leaveWeekRangeLabel(2026, 11, 5)).toBe("11/30(월)");
  });

  it("1일이 목요일인 2026-10의 1주는 달 안의 평일만 표시", () => {
    expect(leaveWeekRangeLabel(2026, 10, 1)).toBe("10/1(목) ~ 10/2(금)");
    expect(leaveWeekRangeLabel(2026, 10, 5)).toBe("10/26(월) ~ 10/30(금)");
  });

  it("달 안에 평일이 없는 주는 null", () => {
    expect(leaveWeekRangeLabel(2026, 2, 5)).toBeNull();
  });
});
