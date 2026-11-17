import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { autolinkFilterExtension } from "./autolink";
import { editorPasteHandler } from "./paste";
import { editorSchema } from "./schema";

type AnyEditor = BlockNoteEditor<any, any, any>;

beforeAll(() => {
  (globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??= class extends Event { clipboardData = null; };
});

afterEach(() => {
  document.body.innerHTML = "";
});

function mount() {
  const editor = BlockNoteEditor.create({ schema: editorSchema, pasteHandler: editorPasteHandler, extensions: [autolinkFilterExtension] });
  const host = document.createElement("div");
  document.body.appendChild(host);
  editor.mount(host);
  editor.setTextCursorPosition(editor.document[0], "end");
  return editor;
}

// 글자를 한 글자씩 치는 것과 같게 입력 (자동 링크는 띄어쓰기 때 붙음)
function type(editor: AnyEditor, text: string) {
  const view = editor.prosemirrorView!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp("handleTextInput", (handle) => handle(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

function paste(editor: AnyEditor, data: Record<string, string>) {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  event.clipboardData = { types: Object.keys(data), getData: (kind: string) => data[kind] ?? "" };
  editor.prosemirrorView!.dom.dispatchEvent(event);
}

// 첫 블록의 링크(글자 → 주소) 목록
function links(editor: AnyEditor) {
  const content = editor.document[0].content as { type: string; href?: string; content?: { text: string }[] }[];
  return content.filter((part) => part.type === "link").map((part) => [part.content!.map((c) => c.text).join(""), part.href]);
}

describe("자동 링크", () => {
  it("setenv.sh처럼 점만 있는 글자는 입력해도 링크로 바꾸지 않는다", () => {
    const editor = mount();
    type(editor, "setenv.sh 실행 ");
    expect(links(editor)).toEqual([]);
    editor.unmount();
  });

  it("https://나 www.로 시작하는 주소는 입력하면 기존처럼 링크가 된다", () => {
    const editor = mount();
    type(editor, "https://example.com 과 www.example.com ");
    expect(links(editor)).toEqual([
      ["https://example.com", "https://example.com"],
      ["www.example.com", "https://www.example.com"],
    ]);
    editor.unmount();
  });

  it("인라인 코드로 붙여넣은 파일 이름은 링크로 바꾸지 않는다", () => {
    const editor = mount();
    paste(editor, { "text/html": "<p><code>setenv.sh</code> 파일</p>", "text/plain": "setenv.sh 파일" });
    expect(links(editor)).toEqual([]);
    expect(editor.document[0].content).toEqual([
      expect.objectContaining({ type: "text", text: "setenv.sh", styles: { code: true } }),
      expect.objectContaining({ type: "text", text: " 파일" }),
    ]);
    editor.unmount();
  });

  it("인라인 코드 안의 https 주소도 붙여넣을 때 링크로 바꾸지 않는다", () => {
    const editor = mount();
    paste(editor, { "text/html": "<p><code>https://example.com/api</code></p>", "text/plain": "https://example.com/api" });
    expect(links(editor)).toEqual([]);
    editor.unmount();
  });

  it("일반 글로 붙여넣은 https 주소는 기존처럼 링크가 된다", () => {
    const editor = mount();
    paste(editor, { "text/plain": "주소 https://example.com 확인" });
    expect(links(editor)).toEqual([["https://example.com", "https://example.com"]]);
    editor.unmount();
  });

  it("붙여넣은 HTML에 원래 있던 링크와 직접 건 링크는 그대로 둔다", () => {
    const editor = mount();
    paste(editor, { "text/html": '<p><a href="https://setenv.sh">setenv.sh</a> </p>', "text/plain": "setenv.sh" });
    expect(links(editor)).toEqual([["setenv.sh", "https://setenv.sh"]]);

    const view = editor.prosemirrorView!;
    editor.setTextCursorPosition(editor.document[0], "end");
    type(editor, "run.sh");
    const end = view.state.selection.from;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end - 6, end)));
    editor.createLink("https://example.com/run.sh");
    expect(links(editor)).toContainEqual(["run.sh", "https://example.com/run.sh"]);
    editor.unmount();
  });
});
