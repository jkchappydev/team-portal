import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_ICON, DEFAULT_PROJECT_ICON, ICON_GROUPS, iconImageSrc, pageIcon, randomIcon } from "./pageIcon";

describe("pageIcon", () => {
  it("아이콘이 없으면 기본 아이콘을 쓴다", () => {
    expect(pageIcon(null)).toBe(DEFAULT_PAGE_ICON);
    expect(pageIcon("")).toBe(DEFAULT_PAGE_ICON);
    expect(pageIcon("🚀")).toBe("🚀");
  });

  it("프로젝트는 아이콘이 없으면 폴더 아이콘을 쓴다", () => {
    expect(DEFAULT_PROJECT_ICON).toBe("📁");
    expect(pageIcon(null, true)).toBe(DEFAULT_PROJECT_ICON);
    expect(pageIcon("", true)).toBe(DEFAULT_PROJECT_ICON);
    expect(pageIcon("🚀", true)).toBe("🚀");
  });

  it("업로드 이미지와 https 주소만 이미지로 보여준다", () => {
    expect(iconImageSrc("att:42")).toBe("/api/attachments/42/download");
    expect(iconImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(iconImageSrc("http://example.com/a.png")).toBeNull();
    expect(iconImageSrc("🚀")).toBeNull();
    expect(iconImageSrc(null)).toBeNull();
  });

  it("랜덤 아이콘은 후보 이모지 중 하나다", () => {
    const all = ICON_GROUPS.flatMap((group) => group.icons);
    expect(randomIcon(() => 0)).toBe(all[0]);
    expect(randomIcon(() => 0.9999)).toBe(all[all.length - 1]);
  });
});
