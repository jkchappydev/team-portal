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

  it.each(["image", "video", "audio", "callout"])("%s 블록은 캡션·상자 가운데가 아니라 위 끝에서 한 줄 블록과 같은 높이에 손잡이를 둔다", (type) => {
    const result = run(mountMediaBlock(type));
    // 손잡이 가운데가 블록 위 끝(100)에서 15px (페이지 블록 한 줄 가운데와 같음): 115 - 손잡이 높이 절반 12
    expect(result.y).toBe(103);
  });

  it("파일 블록은 페이지 블록처럼 파일 이름 줄 가운데에 손잡이를 둔다", () => {
    const block = mountMediaBlock("file");
    const row = document.createElement("div");
    row.className = "bn-file-name-with-icon";
    block.querySelector(".bn-block-content")!.prepend(row);
    placeAt(row, 104, 32);
    const result = run(block);
    // 파일 이름 줄 가운데 120 - 손잡이 높이 절반 12
    expect(result.y).toBe(108);
  });
});
