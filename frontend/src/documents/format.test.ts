import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatFileSize } from "./format";

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

describe("formatDate", () => {
  it("날짜만 YYYY-MM-DD로, 값이 없거나 잘못되면 -", () => {
    expect(formatDate("2026-11-17T03:00:00Z")).toBe("2026-11-17");
    expect(formatDate(null)).toBe("-");
    expect(formatDate("not-a-date")).toBe("-");
  });
});
