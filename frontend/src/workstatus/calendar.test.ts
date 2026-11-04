import { describe, expect, it } from "vitest";
import type { WorkStatusDto } from "../api/workStatuses";
import { buildMonthGrid, expandToWeekdays } from "./calendar";

function item(id: number, startDate: string, endDate: string): WorkStatusDto {
  return {
    id, memberId: 1, memberName: "홍길동", type: "BUSINESS_TRIP", startDate, endDate,
    halfDayPeriod: null, startTime: null, endTime: null, place: "일본", content: null, label: `항목${id}`,
  };
}

describe("buildMonthGrid", () => {
  it("2026-11은 월요일 시작, 첫 칸 2026-10-26(inMonth=false), 11/7은 weekend", () => {
    const grid = buildMonthGrid(2026, 11);
    expect(grid[0][0]).toEqual({ date: "2026-10-26", inMonth: false, weekend: false });
    expect(grid.every((week) => week.length === 7)).toBe(true);
    const nov7 = grid.flat().find((d) => d.date === "2026-11-07");
    expect(nov7).toEqual({ date: "2026-11-07", inMonth: true, weekend: true });
    expect(grid.at(-1)!.at(-1)!.date).toBe("2026-12-06");
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
