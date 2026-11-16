import { describe, expect, it } from "vitest";
import type { WorkStatusDto } from "../api/workStatuses";
import { statusesByDay, monthsOf, thisWeekDays, weekDayLabel } from "./thisWeek";

const status = (id: number, memberName: string, type: WorkStatusDto["type"], startDate: string, endDate = startDate): WorkStatusDto => ({
  id, memberId: id, memberName, type, startDate, endDate, halfDayPeriod: null, startTime: null, endTime: null,
  place: null, content: null, label: `${memberName} ${type}`,
});

describe("thisWeek", () => {
  it("오늘이 속한 주의 월~금을 고르고, 일요일 시작이라 일요일에는 다가오는 주·토요일에는 지난 월~금", () => {
    // 2026-11-18 수요일
    expect(thisWeekDays(new Date(2026, 10, 18)).map((d) => d.date))
      .toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    // 2026-11-21 토요일은 지난 월~금, 2026-11-22 일요일은 다가오는 월~금
    expect(thisWeekDays(new Date(2026, 10, 21))[0].date).toBe("2026-11-16");
    expect(thisWeekDays(new Date(2026, 10, 22))[0].date).toBe("2026-11-23");
    expect(weekDayLabel(thisWeekDays(new Date(2026, 10, 18))[0])).toBe("11/16 (월)");
  });

  it("월말에 걸친 주는 두 달을 조회한다", () => {
    expect(monthsOf(thisWeekDays(new Date(2026, 11, 30)))).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });

  it("모든 근무 상황을 날짜별로 종류 순서대로 모으고 여러 날 항목은 날마다, 겹친 조회는 한 번만", () => {
    const days = thisWeekDays(new Date(2026, 10, 18));
    const leave = status(1, "홍길동", "LEAVE", "2026-11-17", "2026-11-18");
    const result = statusesByDay(days, [
      leave, leave,
      status(2, "김철수", "BUSINESS_TRIP", "2026-11-17"),
      status(3, "가나다", "OTHER", "2026-11-17"),
      status(4, "이영희", "HALF_DAY", "2026-11-17"),
    ]);
    expect(result.get("2026-11-16")).toEqual([]);
    expect(result.get("2026-11-17")!.map((s) => s.memberName)).toEqual(["홍길동", "이영희", "김철수", "가나다"]);
    expect(result.get("2026-11-18")!.map((s) => s.memberName)).toEqual(["홍길동"]);
  });
});
