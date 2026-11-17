import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { editorSchema } from "./schema";

type AnyEditor = BlockNoteEditor<any, any, any>;

function mount(initialContent: any[]) {
  const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent });
  const host = document.createElement("div");
  document.body.appendChild(host);
  editor.mount(host);
  return editor;
}

// 첫 줄(토글 제목)의 offset 위치에 커서를 두고 Enter
function pressEnterAt(editor: AnyEditor, offset: number) {
  const view = editor.prosemirrorView!;
  let start = -1;
  view.state.doc.descendants((node, pos) => {
    if (start < 0 && node.isTextblock) start = pos + 1;
    return start < 0;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start + offset)));
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  view.someProp("handleKeyDown", (handle) => handle(view, event));
}

function shape(blocks: any[]): unknown[] {
  return blocks.map((b) => ({
    type: b.type,
    text: Array.isArray(b.content) ? b.content.map((c: { text?: string }) => c.text ?? "").join("") : "",
    children: shape(b.children),
  }));
}

// 펼친 토글: 토글 블록을 펼친 상태로 표시 (BlockNote는 펼침 여부를 블록 id별로 기억)
function openToggle(editor: AnyEditor) {
  const button = document.querySelector<HTMLButtonElement>(".bn-toggle-button")!;
  if (button.getAttribute("aria-expanded") !== "true") button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  return editor;
}

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("토글 제목에서 Enter", () => {
  it("펼친 토글 제목 끝에서 Enter를 누르면 아래에 새 토글을 만들고 안의 글은 원래 토글에 남긴다", () => {
    const editor = openToggle(mount([
      { type: "toggleListItem", content: "토글", children: [{ type: "paragraph", content: "안의 글" }] },
      { type: "paragraph", content: "다음" },
    ]));
    pressEnterAt(editor, 2);

    expect(shape(editor.document)).toEqual([
      { type: "toggleListItem", text: "토글", children: [{ type: "paragraph", text: "안의 글", children: [] }] },
      { type: "toggleListItem", text: "", children: [] },
      { type: "paragraph", text: "다음", children: [] },
    ]);
    editor.unmount();
  });

  it("접힌 토글에서도 Enter를 누르면 새 토글을 만든다", () => {
    const editor = mount([{ type: "toggleListItem", content: "토글", children: [{ type: "paragraph", content: "안의 글" }] }]);
    pressEnterAt(editor, 2);

    expect(shape(editor.document)).toEqual([
      { type: "toggleListItem", text: "토글", children: [{ type: "paragraph", text: "안의 글", children: [] }] },
      { type: "toggleListItem", text: "", children: [] },
    ]);
    editor.unmount();
  });

  it("제목 중간에서 Enter를 누르면 뒤쪽 글자로 새 토글을 만든다", () => {
    const editor = openToggle(mount([{ type: "toggleListItem", content: "앞뒤", children: [{ type: "paragraph", content: "안의 글" }] }]));
    pressEnterAt(editor, 1);

    expect(shape(editor.document)).toEqual([
      { type: "toggleListItem", text: "앞", children: [{ type: "paragraph", text: "안의 글", children: [] }] },
      { type: "toggleListItem", text: "뒤", children: [] },
    ]);
    editor.unmount();
  });

  it("빈 토글 제목에서 Enter를 누르면 기존처럼 일반 글줄로 바뀐다", () => {
    const editor = mount([{ type: "toggleListItem", content: "" }]);
    pressEnterAt(editor, 0);

    expect(editor.document[0].type).toBe("paragraph");
    editor.unmount();
  });
});
