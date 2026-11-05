import { describe, expect, it } from "vitest";
import { calculateWeekMinHeight } from "./calendarLayout";

describe("calculateWeekMinHeight", () => {
  it("근무 상황이 두 건 이하면 기본 높이를 유지한다", () => {
    expect(calculateWeekMinHeight([0, 1, 2, 0, 0, 0, 0])).toBe(92);
  });

  it("같은 날짜에 세 건 이상이면 모든 항목이 보이도록 주차 높이를 늘린다", () => {
    expect(calculateWeekMinHeight([0, 0, 3, 1, 0, 0, 0])).toBe(92);
    expect(calculateWeekMinHeight([0, 0, 5, 1, 0, 0, 0])).toBe(128);
    expect(calculateWeekMinHeight([0, 0, 14, 1, 0, 0, 0])).toBe(308);
  });
});
