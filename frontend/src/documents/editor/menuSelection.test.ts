import { afterEach, describe, expect, it } from "vitest";
import { isDeleteKey, markMenuBlock } from "./menuSelection";

describe("블록 메뉴 선택", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("메뉴가 열린 블록에 선택 표시를 붙이고 닫히면 뗀다", () => {
    document.body.innerHTML = '<div class="bn-editor"><div class="bn-block" data-id="a"></div><div class="bn-block" data-id="b"></div></div>';
    const release = markMenuBlock("b");
    expect(document.querySelector('[data-id="b"]')!.hasAttribute("data-menu-selected")).toBe(true);
    expect(document.querySelector('[data-id="a"]')!.hasAttribute("data-menu-selected")).toBe(false);
    release();
    expect(document.querySelector("[data-menu-selected]")).toBeNull();
  });

  it("Delete·Backspace는 블록 삭제 키이고, 한글 조합 중 입력과 다른 키는 아니다", () => {
    expect(isDeleteKey({ key: "Delete", isComposing: false })).toBe(true);
    expect(isDeleteKey({ key: "Backspace", isComposing: false })).toBe(true);
    expect(isDeleteKey({ key: "Delete", isComposing: true })).toBe(false);
    expect(isDeleteKey({ key: "Enter", isComposing: false })).toBe(false);
  });
});
