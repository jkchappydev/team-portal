import { describe, expect, it } from "vitest";
import { CONTACT_COLORS, contactColor } from "./contactColor";

describe("contactColor", () => {
  it("고른 색이 있으면 그 색을 쓴다", () => {
    expect(contactColor({ id: 1, color: "#123456" })).toBe("#123456");
  });

  it("색을 고르지 않으면 번호마다 늘 같은 색을 12색 중에서 정한다", () => {
    const first = contactColor({ id: 7, color: null });
    expect(contactColor({ id: 7, color: null })).toBe(first);
    expect(CONTACT_COLORS).toContain(first);
    // 연속한 12명은 모두 다른 색
    const used = new Set(Array.from({ length: 12 }, (_, i) => contactColor({ id: i + 1, color: null })));
    expect(used.size).toBe(12);
  });
});
