import { describe, expect, it } from "vitest";
import { USER_COLORS, userColor } from "./userColor";

describe("userColor", () => {
  it("userColor는 같은 ID에 항상 같은 색, 8 이상은 순환", () => {
    expect(USER_COLORS).toHaveLength(8);
    expect(userColor(1)).toBe(userColor(1));
    expect(userColor(1)).toBe(userColor(9));
    expect(userColor(0)).toBe(USER_COLORS[0]);
    expect(userColor(3)).toBe(USER_COLORS[3]);
    expect(userColor(1)).not.toBe(userColor(2));
  });
});
