import { describe, expect, it } from "vitest";
import { fileKindOf } from "./formFile";

describe("fileKindOf", () => {
  it("문서는 확장자와 상관없이 같은 종류로 본다", () => {
    for (const name of ["회의록.docx", "품의서.xlsx", "발표.pptx", "공문.hwp", "안내.pdf", "메모.txt", "확장자없음"]) {
      expect(fileKindOf(name)).toBe("document");
    }
  });

  it("압축·실행 파일·이미지·영상은 따로 구분한다", () => {
    expect(fileKindOf("자료.ZIP")).toBe("archive");
    expect(fileKindOf("백업.tar.gz")).toBe("archive");
    expect(fileKindOf("설치.exe")).toBe("app");
    expect(fileKindOf("앱.apk")).toBe("app");
    expect(fileKindOf("사진.jpg")).toBe("image");
    expect(fileKindOf("녹화.mp4")).toBe("media");
  });
});
