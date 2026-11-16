import { describe, expect, it } from "vitest";
import { currentMonthOf, currentWeekOf } from "./highlight";

describe("currentMonthOf", () => {
  it("올해면 이번 달, 다른 해면 null을 돌려준다", () => {
    const now = new Date(2026, 10, 4);
    expect(currentMonthOf(2026, now)).toBe(11);
    expect(currentMonthOf(2025, now)).toBeNull();
  });
});

describe("currentWeekOf", () => {
  it("오늘이 속한 월·주를 백엔드 주 계산과 같게 돌려준다", () => {
    // 2026년 11월 1일은 일요일이라 11/2(월)~11/6이 1주, 11/9~11/13이 2주
    expect(currentWeekOf(2026, new Date(2026, 10, 13))).toEqual({ month: 11, week: 2 });
    expect(currentWeekOf(2026, new Date(2026, 10, 1))).toEqual({ month: 11, week: 1 });
    expect(currentWeekOf(2026, new Date(2026, 10, 30))).toEqual({ month: 11, week: 5 });
    // 2026년 7월 1일은 수요일이라 그 주가 1주
    expect(currentWeekOf(2026, new Date(2026, 6, 3))).toEqual({ month: 7, week: 1 });
    expect(currentWeekOf(2026, new Date(2026, 6, 6))).toEqual({ month: 7, week: 2 });
    // 일요일 시작이라 일요일(11/8)은 다음 주, 토요일(11/7)은 그 주
    expect(currentWeekOf(2026, new Date(2026, 10, 7))).toEqual({ month: 11, week: 1 });
    expect(currentWeekOf(2026, new Date(2026, 10, 8))).toEqual({ month: 11, week: 2 });
  });

  it("다른 해를 보면 null을 돌려준다", () => {
    expect(currentWeekOf(2025, new Date(2026, 10, 13))).toBeNull();
  });
});
