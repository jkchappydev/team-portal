import { describe, expect, it, vi } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { alignSelection, clearFormatting, shortcutLabel } from "./formatShortcuts";
import { editorSchema } from "./schema";

function createEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { type: "paragraph", content: "가" },
      { type: "paragraph", content: "나" },
      { type: "codeBlock", content: "x" },
    ],
  });
}

describe("alignSelection", () => {
  it("커서가 있는 블록의 정렬을 바꾼다", () => {
    const editor = createEditor();
    editor.setTextCursorPosition(editor.document[0], "end");
    expect(alignSelection(editor, "center")).toBe(true);
    expect(editor.document[0].props).toMatchObject({ textAlignment: "center" });
    expect(editor.document[1].props).toMatchObject({ textAlignment: "left" });
  });

  it("여러 블록을 고르면 모두 바꾼다", () => {
    const editor = createEditor();
    editor.setSelection(editor.document[0], editor.document[1]);
    expect(alignSelection(editor, "right")).toBe(true);
    expect(editor.document.slice(0, 2).map((b) => b.props)).toMatchObject([{ textAlignment: "right" }, { textAlignment: "right" }]);
  });

  it("정렬할 수 없는 블록(코드 블록)만 고르면 처리하지 않고 넘긴다", () => {
    const editor = createEditor();
    editor.setTextCursorPosition(editor.document[2]);
    expect(alignSelection(editor, "right")).toBe(false);
  });
});

describe("clearFormatting", () => {
  it("링크를 뺀 굵게·기울임·밑줄·취소선·코드·글자색·배경색을 지운다", () => {
    const removeStyles = vi.fn();
    clearFormatting({ removeStyles });
    expect(Object.keys(removeStyles.mock.calls[0][0]).sort())
      .toEqual(["backgroundColor", "bold", "code", "italic", "strike", "textColor", "underline"]);
  });
});

describe("shortcutLabel", () => {
  it("Windows에서는 Mod를 Ctrl로 보여준다", () => {
    expect(shortcutLabel("Mod+Shift+L")).toBe("Ctrl+Shift+L");
  });
});
