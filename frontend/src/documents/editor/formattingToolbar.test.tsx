import { describe, expect, it } from "vitest";
import { formattingToolbarItems } from "./formattingToolbar";

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
});
