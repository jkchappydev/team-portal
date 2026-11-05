import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_ICON, ICON_GROUPS, pageIcon, randomIcon } from "./pageIcon";

describe("pageIcon", () => {
  it("아이콘이 없으면 기본 아이콘을 쓴다", () => {
    expect(pageIcon(null)).toBe(DEFAULT_PAGE_ICON);
    expect(pageIcon("")).toBe(DEFAULT_PAGE_ICON);
    expect(pageIcon("🚀")).toBe("🚀");
  });

  it("랜덤 아이콘은 선택 창의 이모지 중 하나다", () => {
    const all = ICON_GROUPS.flatMap((group) => group.icons);
    expect(randomIcon(() => 0)).toBe(all[0]);
    expect(randomIcon(() => 0.9999)).toBe(all[all.length - 1]);
  });
});
