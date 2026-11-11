import { describe, expect, it } from "vitest";
import { pasteOptions } from "./paste";

describe("pasteOptions", () => {
  it("HTML이 함께 오면 마크다운보다 HTML(표 구조 등)을 우선한다", () => {
    expect(pasteOptions(["text/plain", "text/html", "text/_notion-table"])).toEqual({ prioritizeMarkdownOverHTML: false });
  });

  it("일반 텍스트만 오면 마크다운 여부를 판단한다", () => {
    expect(pasteOptions(["text/plain"])).toEqual({ prioritizeMarkdownOverHTML: true });
  });
});
