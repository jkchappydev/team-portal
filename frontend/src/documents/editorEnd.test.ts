import { describe, expect, it, vi } from "vitest";
import { focusEditorEnd, isBelowLastBlock, releaseBlockSelection } from "./editorEnd";
import type { EndEditor } from "./editorEnd";

function fakeEditor(document: EndEditor["document"]) {
  return {
    document,
    insertBlocks: vi.fn((_blocks: { type: "paragraph" }[], _reference: string, _placement: "after") => [{ id: "new" }]),
    setTextCursorPosition: vi.fn((_block: string, _placement: "end") => {}),
    focus: vi.fn(() => {}),
  };
}

describe("isBelowLastBlock", () => {
  function container(bottoms: number[]) {
    const root = document.createElement("div");
    root.innerHTML = `<div class="bn-editor"><div class="bn-block-group">${
      bottoms.map(() => `<div class="bn-block-outer"><div class="bn-block-group"><div class="bn-block-outer"></div></div></div>`).join("")
    }</div></div>`;
    root.querySelectorAll<HTMLElement>(".bn-editor > .bn-block-group > .bn-block-outer").forEach((el, i) => {
      el.getBoundingClientRect = () => ({ bottom: bottoms[i] }) as DOMRect;
    });
    return root;
  }

  it("마지막 최상위 블록 아래를 누르면 참이다", () => {
    expect(isBelowLastBlock(container([100, 600]), 610)).toBe(true);
  });

  it("마지막 블록 안이나 위를 누르면 거짓이다", () => {
    expect(isBelowLastBlock(container([100, 600]), 600)).toBe(false);
    expect(isBelowLastBlock(container([100, 600]), 50)).toBe(false);
  });

  it("블록이 없으면 거짓이다", () => {
    expect(isBelowLastBlock(document.createElement("div"), 10)).toBe(false);
  });
});

describe("focusEditorEnd", () => {
  it("마지막 블록이 이미지면 아래에 빈 줄을 만들고 그 줄로 커서를 옮긴다", () => {
    const editor = fakeEditor([{ id: "h", type: "heading", content: [] }, { id: "img", type: "image" }]);

    focusEditorEnd(editor);

    expect(editor.insertBlocks).toHaveBeenCalledWith([{ type: "paragraph" }], "img", "after");
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith("new", "end");
    expect(editor.focus).toHaveBeenCalled();
  });

  it("마지막 블록이 빈 줄이면 새로 만들지 않고 그 줄로 커서를 옮긴다", () => {
    const editor = fakeEditor([{ id: "img", type: "image" }, { id: "p", type: "paragraph", content: [] }]);

    focusEditorEnd(editor);

    expect(editor.insertBlocks).not.toHaveBeenCalled();
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith("p", "end");
  });

  it("마지막 줄에 글이 있으면 아래에 빈 줄을 만든다", () => {
    const editor = fakeEditor([{ id: "p", type: "paragraph", content: [{ type: "text", text: "가" }] }]);

    focusEditorEnd(editor);

    expect(editor.insertBlocks).toHaveBeenCalledWith([{ type: "paragraph" }], "p", "after");
  });
});

describe("releaseBlockSelection", () => {
  function page() {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="bn-block" data-id="img"><div class="bn-block-content ProseMirror-selectednode" data-content-type="image"><img /></div></div>
      <div class="bn-block" data-id="p"><div class="bn-block-content" data-content-type="paragraph"><p class="bn-inline-content"><br /></p></div></div>`;
    return root;
  }
  function selectionEditor(type: string) {
    return {
      prosemirrorState: { selection: { toJSON: () => ({ type }) } },
      setTextCursorPosition: vi.fn((_block: string, _placement: "end") => {}),
    };
  }

  it("이미지가 선택된 채 다른 글 줄을 누르면 그 줄로 커서를 먼저 옮긴다", () => {
    const editor = selectionEditor("node");
    releaseBlockSelection(editor, page().querySelector("p")!);
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith("p", "end");
  });

  it("선택된 이미지 자체를 누르면 그대로 둔다", () => {
    const editor = selectionEditor("node");
    releaseBlockSelection(editor, page().querySelector("img")!);
    expect(editor.setTextCursorPosition).not.toHaveBeenCalled();
  });

  it("글자 선택 중이면 편집기에 맡긴다", () => {
    const editor = selectionEditor("text");
    releaseBlockSelection(editor, page().querySelector("p")!);
    expect(editor.setTextCursorPosition).not.toHaveBeenCalled();
  });
});
