import { describe, expect, it } from "vitest";
import { currentMonthOf } from "./highlight";

describe("currentMonthOf", () => {
  it("올해면 이번 달, 다른 해면 null을 돌려준다", () => {
    const now = new Date(2026, 10, 4);
    expect(currentMonthOf(2026, now)).toBe(11);
    expect(currentMonthOf(2025, now)).toBeNull();
  });
});
