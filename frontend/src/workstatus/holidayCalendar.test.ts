import { describe, expect, it } from "vitest";
import { groupHolidaysByDate } from "./holidayCalendar";

describe("groupHolidaysByDate", () => {
  it("같은 날짜의 공휴일 명칭을 함께 묶는다", () => {
    const grouped = groupHolidaysByDate([
      { date: "2026-06-03", name: "전국동시지방선거" },
      { date: "2026-06-03", name: "임시공휴일" },
      { date: "2026-06-06", name: "현충일" },
    ]);

    expect(grouped.get("2026-06-03")?.map((item) => item.name))
      .toEqual(["전국동시지방선거", "임시공휴일"]);
    expect(grouped.get("2026-06-06")?.map((item) => item.name)).toEqual(["현충일"]);
  });
});
