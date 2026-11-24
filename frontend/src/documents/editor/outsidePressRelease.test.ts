import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { NodeSelection } from "@tiptap/pm/state";
import { editorSchema } from "./schema";
import { isBlockLevelSelection, isOutsidePress, outsidePressReleaseExtension } from "./outsidePressRelease";

const mounted: { unmount: () => void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((editor) => editor.unmount());
  document.body.replaceChildren();
});

describe("isOutsidePress", () => {
  it("편집 영역 밖 빈 곳은 바깥, 편집 영역·메뉴·손잡이·칸 메뉴 버튼은 바깥이 아니다", () => {
    const editorDom = document.createElement("div");
    const inside = document.createElement("p");
    editorDom.appendChild(inside);
    const outside = document.createElement("div");
    const menu = document.createElement("div");
    menu.className = "mantine-Menu-dropdown";
    const menuItem = document.createElement("button");
    menu.appendChild(menuItem);
    const sideMenu = document.createElement("div");
    sideMenu.className = "bn-side-menu";
    const handle = document.createElement("button");
    sideMenu.appendChild(handle);
    const cellButton = document.createElement("button");
    cellButton.className = "cell-selection-handle";
    document.body.append(editorDom, outside, menu, sideMenu, cellButton);
    expect(isOutsidePress(outside, editorDom)).toBe(true);
    expect(isOutsidePress(inside, editorDom)).toBe(false);
    expect(isOutsidePress(menuItem, editorDom)).toBe(false);
    expect(isOutsidePress(handle, editorDom)).toBe(false);
    expect(isOutsidePress(cellButton, editorDom)).toBe(false);
  });

  it("블록 전체 선택과 표 칸 선택만 풀 대상이다", () => {
    expect(isBlockLevelSelection("node")).toBe(true);
    expect(isBlockLevelSelection("cell")).toBe(true);
    expect(isBlockLevelSelection("text")).toBe(false);
  });
});

// 예전에는 이미지 등 블록을 선택한 채 편집기 밖을 눌러도 파란 선택 표시가 남았음
describe("outsidePressReleaseExtension", () => {
  function editorWithImage() {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      extensions: [outsidePressReleaseExtension()],
      initialContent: [{ type: "paragraph", content: "위" }, { type: "image", props: { url: "https://example.com/a.png" } }] as never,
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    mounted.push(editor);
    // 이미지 블록 전체 선택
    let imagePos = -1;
    editor.prosemirrorState.doc.descendants((node, pos) => {
      if (node.type.name === "image") imagePos = pos;
      return imagePos < 0;
    });
    const view = editor.prosemirrorView;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, imagePos)));
    return editor;
  }

  it("편집기 밖을 누르면 블록 선택을 푼다", () => {
    const editor = editorWithImage();
    expect(editor.prosemirrorState.selection.toJSON().type).toBe("node");
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    expect(editor.prosemirrorState.selection.toJSON().type).toBe("text");
  });

  it("띄운 메뉴 안을 누르면 블록 선택을 유지한다", () => {
    const editor = editorWithImage();
    const menu = document.createElement("div");
    menu.className = "mantine-Menu-dropdown";
    document.body.appendChild(menu);
    menu.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    expect(editor.prosemirrorState.selection.toJSON().type).toBe("node");
  });
});
