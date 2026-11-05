import { describe, expect, it } from "vitest";
import { decodeText, previewKindOf } from "./previewKind";

describe("previewKindOf", () => {
  it("확장자로 미리보기 방식을 정한다", () => {
    expect(previewKindOf("회의록.docx")).toBe("docx");
    expect(previewKindOf("품의서.XLSX")).toBe("xlsx");
    expect(previewKindOf("안내.pdf")).toBe("pdf");
    expect(previewKindOf("사진.png")).toBe("image");
    expect(previewKindOf("목록.csv")).toBe("text");
    // 구형 엑셀·한글·SVG는 미리보기 미지원
    expect(previewKindOf("예전.xls")).toBe("none");
    expect(previewKindOf("보고서.hwp")).toBe("none");
    expect(previewKindOf("그림.svg")).toBe("none");
  });
});

describe("decodeText", () => {
  it("UTF-8은 그대로 읽는다", () => {
    expect(decodeText(new TextEncoder().encode("이름,금액").buffer as ArrayBuffer)).toBe("이름,금액");
  });

  it("UTF-8로 읽을 수 없으면 EUC-KR로 읽는다", () => {
    // "가" (EUC-KR: B0 A1)
    expect(decodeText(new Uint8Array([0xb0, 0xa1]).buffer)).toBe("가");
  });
});
