import { describe, expect, it } from "vitest";
import { formattingToolbarFloatingOptions, formattingToolbarItems, TOOLBAR_GAP } from "./formattingToolbar";

describe("formattingToolbarItems", () => {
  it("블록 종류 다음에 노션 순서(색·굵게·기울임·밑줄·서식 지우기·링크·취소선·코드)로 두고 정렬·들여쓰기는 뒤에 둔다", () => {
    const keys = formattingToolbarItems().map((item) => item.key);
    const notion = ["colorStyleButton", "boldStyleButton", "italicStyleButton", "underlineStyleButton",
      "clearFormattingButton", "createLinkButton", "strikeStyleButton", "codeStyleButton"];
    const start = keys.indexOf("colorStyleButton");
    expect(keys[0]).toBe("blockTypeSelect");
    expect(keys.slice(start, start + notion.length)).toEqual(notion);
    expect(keys.indexOf("textAlignLeftButton")).toBeGreaterThan(keys.indexOf("codeStyleButton"));
    expect(keys.indexOf("unnestBlockButton")).toBeGreaterThan(keys.indexOf("textAlignRightButton"));
  });

  it("이미지 펼치기 버튼은 삭제 다음, 다운로드 앞에 둔다", () => {
    const keys = formattingToolbarItems().map((item) => item.key);
    expect(keys.indexOf("imageExpandButton")).toBe(keys.indexOf("fileDeleteButton") + 1);
    expect(keys.indexOf("fileDownloadButton")).toBe(keys.indexOf("imageExpandButton") + 1);
  });
});

// 예전에는 기본 간격(10px)이라 서식 도구 막대가 드래그한 글에 거의 붙어 보였음
describe("formattingToolbarFloatingOptions", () => {
  it("선택한 글과 막대 사이를 기본보다 넓게 띄우고 밀어내기·뒤집기는 유지한다", () => {
    const middleware = formattingToolbarFloatingOptions.useFloatingOptions?.middleware ?? [];
    const names = middleware.map((m) => (m && typeof m === "object" ? m.name : null));
    expect(names).toEqual(["offset", "shift", "flip"]);
    const offset = middleware[0] as { options?: unknown[] };
    expect(offset.options?.[0]).toBe(TOOLBAR_GAP);
    expect(TOOLBAR_GAP).toBeGreaterThan(10);
  });
});
