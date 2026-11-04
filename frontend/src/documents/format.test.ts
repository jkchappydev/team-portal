import { describe, expect, it } from "vitest";
import { formatDateTime, formatFileSize } from "./format";

describe("format", () => {
  it("잘못된 시각은 '-'로 표시한다", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("-");
    expect(formatDateTime("2026-11-04T01:02:00Z")).toMatch(/^2026-11-0[45] \d{2}:02$/);
  });

  it("파일 크기를 단위와 함께 표시한다", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
