import { afterEach, describe, expect, it, vi } from "vitest";
import { animateCheckToggle } from "./checkListAnimation";

// 체크리스트 블록 하나 (BlockNote가 그리는 구조와 같음)
function editorWithCheckItem(): HTMLElement {
  const dom = document.createElement("div");
  dom.innerHTML = `
    <div class="bn-block-outer" data-id="b1"><div class="bn-block" data-id="b1">
      <div class="bn-block-content" data-content-type="checkListItem" data-checked="true">
        <div contenteditable="false"><input type="checkbox" checked></div><p class="bn-inline-content">할 일</p>
      </div>
    </div></div>`;
  document.body.appendChild(dom);
  return dom;
}

describe("animateCheckToggle", () => {
  const animate = vi.fn();
  HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];

  afterEach(() => {
    animate.mockClear();
    document.body.innerHTML = "";
  });

  it("체크하면 상자가 튀고 취소선이 투명에서 서서히 나타난다", () => {
    animateCheckToggle(editorWithCheckItem(), "b1", true);
    const [box, text] = animate.mock.contexts as HTMLElement[];
    expect(box.tagName).toBe("INPUT");
    expect(text.classList.contains("bn-inline-content")).toBe(true);
    expect(animate.mock.calls[1][0][0].textDecorationColor).toBe("transparent");
  });

  it("체크를 해제하면 상자만 튄다", () => {
    animateCheckToggle(editorWithCheckItem(), "b1", false);
    expect(animate).toHaveBeenCalledTimes(1);
  });
});
