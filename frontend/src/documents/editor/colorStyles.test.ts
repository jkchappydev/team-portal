import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { nearestColorName, parseBackgroundColor, parseCssColor, parseTextColor } from "./colorStyles";
import { editorSchema } from "./schema";

function element(html: string): HTMLElement {
  const box = document.createElement("div");
  box.innerHTML = html;
  return box.firstElementChild as HTMLElement;
}

describe("parseCssColor", () => {
  it("#hex·rgb()·rgba()를 읽는다", () => {
    expect(parseCssColor("#D44C47")).toEqual([212, 76, 71, 1]);
    expect(parseCssColor("#fff")).toEqual([255, 255, 255, 1]);
    expect(parseCssColor("rgb(51, 126, 169)")).toEqual([51, 126, 169, 1]);
    expect(parseCssColor("rgba(0, 0, 0, 0)")).toEqual([0, 0, 0, 0]);
  });
});

describe("nearestColorName", () => {
  it("노션 색은 같은 이름으로, 비슷한 색은 가장 가까운 이름으로 바꾼다", () => {
    expect(nearestColorName("#D44C47", "text")).toBe("red");
    expect(nearestColorName("rgb(51, 126, 169)", "text")).toBe("blue");
    expect(nearestColorName("#ff0000", "text")).toBe("red");
    expect(nearestColorName("#ffff00", "background")).toBe("yellow");
    expect(nearestColorName("rgb(251, 236, 221)", "background")).toBe("orange");
  });

  it("검정·흰색 등 기본 글자색·배경, 투명은 색을 넣지 않는다", () => {
    expect(nearestColorName("#000000", "text")).toBeUndefined();
    expect(nearestColorName("rgb(55, 53, 47)", "text")).toBeUndefined();
    expect(nearestColorName("#ffffff", "background")).toBeUndefined();
    expect(nearestColorName("transparent", "background")).toBeUndefined();
  });
});

describe("붙여넣기 색 읽기", () => {
  it("span·font의 글자색, 노션 내보내기 형광펜 class를 읽는다", () => {
    expect(parseTextColor(element('<span style="color:#337EA9">a</span>'))).toBe("blue");
    expect(parseTextColor(element('<font color="#ff0000">a</font>'))).toBe("red");
    expect(parseTextColor(element('<mark class="highlight-purple">a</mark>'))).toBe("purple");
  });

  it("배경색과 <mark> 형광펜을 읽는다", () => {
    expect(parseBackgroundColor(element('<span style="background-color:#FBF3DB">a</span>'))).toBe("yellow");
    expect(parseBackgroundColor(element("<mark>a</mark>"))).toBe("yellow");
    expect(parseBackgroundColor(element('<mark class="highlight-red_background">a</mark>'))).toBe("red");
    expect(parseBackgroundColor(element('<mark class="highlight-red">a</mark>'))).toBeUndefined();
  });

  it("편집기 자체 색 표시와 문단 같은 블록 요소는 여기서 읽지 않는다", () => {
    expect(parseTextColor(element('<span data-style-type="textColor" data-value="red" style="color:#0000ff">a</span>'))).toBeUndefined();
    expect(parseTextColor(element('<p style="color:#ff0000">a</p>'))).toBeUndefined();
  });
});

describe("외부 HTML 붙여넣기", () => {
  it("외부 색은 색 이름으로 저장되어 화면 색표·색 메뉴와 맞는다", async () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema });
    const blocks = await editor.tryParseHTMLToBlocks(
      '<p><span style="color:rgb(212, 76, 71)">빨강</span><span style="background-color:#fbf3db">노랑 배경</span></p>',
    );
    expect(blocks[0].content).toEqual([
      { type: "text", text: "빨강", styles: { textColor: "red" } },
      { type: "text", text: "노랑 배경", styles: { backgroundColor: "yellow" } },
    ]);
  });
});
