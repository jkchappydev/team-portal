import { afterEach, describe, expect, it } from "vitest";
import { alignSideMenu } from "./AlignedSideMenuController";

// 요소 위치를 고정값으로 흉내
function placeAt(element: Element, top: number, height: number) {
  element.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) });
}

// 이미지 블록: 위에 그림, 아래에 캡션 글줄
function mountMediaBlock(type: string) {
  const editor = document.createElement("div");
  editor.className = "bn-editor";
  const block = document.createElement("div");
  block.className = "bn-block";
  block.dataset.id = "media";
  const content = document.createElement("div");
  content.className = "bn-block-content";
  content.setAttribute("data-content-type", type);
  const caption = document.createElement("p");
  caption.className = "bn-inline-content";
  caption.textContent = "캡션";
  content.appendChild(caption);
  block.appendChild(content);
  editor.appendChild(block);
  document.body.appendChild(editor);
  placeAt(block, 100, 300);
  placeAt(content, 100, 300);
  placeAt(caption, 380, 20);
  return block;
}

function run(block: HTMLElement) {
  const reference = document.createElement("div");
  placeAt(reference, block.getBoundingClientRect().top, 300);
  const middleware = alignSideMenu(() => block.dataset.id) as { fn: (state: never) => unknown };
  const state = { x: 50, y: 100, rects: { floating: { height: 24 } }, elements: { reference } };
  return middleware.fn(state as never) as { x: number; y: number };
}

describe("alignSideMenu", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(["image", "video", "audio", "file"])("%s 블록은 캡션이 아니라 블록 위 끝에 손잡이를 붙인다", (type) => {
    const result = run(mountMediaBlock(type));
    // 손잡이 위 끝이 블록 위 끝(100)보다 손잡이 틀 안쪽 여백 3px만큼 위
    expect(result.y).toBe(97);
  });
});
