import { describe, expect, it } from "vitest";
import { focusTitleState, shouldFocusTitle } from "./titleFocus";

describe("titleFocus", () => {
  it("새로 만든 그 페이지에서만 제목에 포커스를 준다", () => {
    const { state } = focusTitleState(7);
    expect(shouldFocusTitle(state, 7)).toBe(true);
    expect(shouldFocusTitle(state, 8)).toBe(false);
    expect(shouldFocusTitle(null, 7)).toBe(false);
    expect(shouldFocusTitle(undefined, 7)).toBe(false);
  });
});
