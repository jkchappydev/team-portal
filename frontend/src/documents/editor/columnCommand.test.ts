import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { insertColumns, isInsideColumn } from "./columnCommand";
import { editorSchema } from "./schema";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(initialContent: any[]) {
  const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent });
  const host = document.createElement("div");
  document.body.appendChild(host);
  editor.mount(host);
  return editor;
}

describe("insertColumns", () => {
  it("빈 줄에서 /2단을 고르면 그 줄을 두 열로 바꾸고 첫 열에 커서를 둔다", () => {
    const editor = mount([{ id: "a", type: "paragraph", content: "" }]);
    editor.setTextCursorPosition("a", "end");
    insertColumns(editor, 2);

    const list = editor.document[0];
    expect(list.type).toBe("columnList");
    expect(list.children.map((column) => [column.type, column.children.map((child) => child.type)])).toEqual([
      ["column", ["paragraph"]],
      ["column", ["paragraph"]],
    ]);
    expect(editor.getTextCursorPosition().block.id).toBe(list.children[0].children[0].id);
    editor.unmount();
  });

  it("글이 있는 줄에서는 아래에 세 열을 넣는다", () => {
    const editor = mount([{ id: "a", type: "paragraph", content: "글" }]);
    editor.setTextCursorPosition("a", "end");
    insertColumns(editor, 3);

    expect(editor.document.map((block) => block.type)).toEqual(["paragraph", "columnList"]);
    expect(editor.document[1].children).toHaveLength(3);
    editor.unmount();
  });

  it("열 안에서는 열을 더 만들지 않는다", () => {
    const editor = mount([{ type: "columnList", children: [
      { type: "column", children: [{ id: "a", type: "paragraph", content: "" }] },
      { type: "column", children: [{ type: "paragraph", content: "나" }] },
    ] }]);
    editor.setTextCursorPosition("a", "end");
    expect(isInsideColumn(editor)).toBe(true);
    insertColumns(editor, 2);

    expect(editor.document).toHaveLength(1);
    expect(editor.document[0].children[0].children.map((child) => child.type)).toEqual(["paragraph"]);
    editor.unmount();
  });
});
