import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { editorPasteHandler, keepLineTypeOnPasteExtension, pasteOptions } from "./paste";
import { editorSchema } from "./schema";

describe("pasteOptions", () => {
  it("HTML이 함께 오면 마크다운보다 HTML(표 구조 등)을 우선한다", () => {
    expect(pasteOptions(["text/plain", "text/html", "text/_notion-table"])).toEqual({ prioritizeMarkdownOverHTML: false });
  });

  it("일반 텍스트만 오면 마크다운 여부를 판단한다", () => {
    expect(pasteOptions(["text/plain"])).toEqual({ prioritizeMarkdownOverHTML: true });
  });
});

describe("editorPasteHandler", () => {
  // jsdom에는 ClipboardEvent가 없어 ProseMirror 붙여넣기가 멈추므로 빈 형태만 채움
  beforeAll(() => {
    (globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??= class extends Event { clipboardData = null; };
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // 실제 화면과 같은 붙여넣기 처리로 편집기를 띄움
  function mount(initialContent: Parameters<typeof BlockNoteEditor.create>[0] extends infer O ? O extends { initialContent?: infer C } ? C : never : never) {
    const editor = BlockNoteEditor.create({
      schema: editorSchema, initialContent, pasteHandler: editorPasteHandler, extensions: [keepLineTypeOnPasteExtension],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    return editor;
  }

  // index번째 글줄의 글자 전체를 선택 (줄을 세 번 클릭했을 때와 같은 선택)
  function selectWholeLine(editor: BlockNoteEditor<any, any, any>, index = 0) {
    const view = editor.prosemirrorView!;
    let start = -1;
    let seen = 0;
    view.state.doc.descendants((node, pos) => {
      if (start < 0 && node.isTextblock && seen++ === index) start = pos + 1;
      return start < 0;
    });
    const line = view.state.doc.resolve(start).parent;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start, start + line.content.size)));
  }

  // 편집기 안 복사 (blocknote/html 등 실제 복사 데이터를 받아 둠)
  function copy(editor: BlockNoteEditor<any, any, any>) {
    const data: Record<string, string> = {};
    const event = new Event("copy", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    event.clipboardData = { setData: (type: string, value: string) => { data[type] = value; }, clearData: () => {}, getData: () => "" };
    editor.prosemirrorView!.dom.dispatchEvent(event);
    return data;
  }

  function paste(editor: BlockNoteEditor<any, any, any>, data: Record<string, string>) {
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    event.clipboardData = { types: Object.keys(data), getData: (type: string) => data[type] ?? "" };
    editor.prosemirrorView!.dom.dispatchEvent(event);
  }

  it("안이 빈 토글 제목 줄 글자 전체를 선택하고 제목 블록을 붙여넣어도 토글이 남는다", () => {
    const editor = mount([
      { type: "toggleListItem", content: "토글제목" },
      { type: "heading", props: { level: 1 }, content: "제목1" },
    ]);
    // 아래 제목1 줄을 세 번 클릭해 복사하고, 토글 제목 줄을 세 번 클릭해 붙여넣음
    selectWholeLine(editor, 1);
    const copied = copy(editor);
    selectWholeLine(editor, 0);
    paste(editor, copied);

    expect(editor.document[0]).toMatchObject({
      type: "toggleListItem",
      content: [{ type: "text", text: "제목1" }],
    });
    expect(editor.document[1]).toMatchObject({ type: "heading", content: [{ type: "text", text: "제목1" }] });
    editor.unmount();
  });

  it("안에 글이 있는 토글도 제목 줄을 바꿔도 안의 글이 그대로 남는다", () => {
    const editor = mount([
      { type: "toggleListItem", content: "토글제목", children: [{ type: "paragraph", content: "안의 글" }] },
      { type: "heading", props: { level: 1 }, content: "제목1" },
    ]);
    selectWholeLine(editor, 2);
    const copied = copy(editor);
    selectWholeLine(editor, 0);
    paste(editor, copied);

    expect(editor.document[0]).toMatchObject({
      type: "toggleListItem",
      content: [{ type: "text", text: "제목1" }],
      children: [{ type: "paragraph", content: [{ type: "text", text: "안의 글" }] }],
    });
    editor.unmount();
  });

  it("체크리스트 줄도 글자 전체를 선택하고 제목을 붙여넣으면 체크리스트로 남는다", () => {
    const editor = mount([{ type: "checkListItem", props: { checked: true }, content: "할 일" }]);
    selectWholeLine(editor);
    paste(editor, { "text/html": "<h2>새 제목</h2>", "text/plain": "새 제목" });

    expect(editor.document[0]).toMatchObject({ type: "checkListItem", props: { checked: true }, content: [{ type: "text", text: "새 제목" }] });
    editor.unmount();
  });

  it("줄 일부만 선택하면 기존처럼 선택한 글자만 바꾼다", () => {
    const editor = mount([{ type: "toggleListItem", content: "토글제목" }]);
    const view = editor.prosemirrorView!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3, 5)));
    paste(editor, { "text/plain": "새" });

    expect(editor.document[0]).toMatchObject({ type: "toggleListItem", content: [{ type: "text", text: "새제목" }] });
    editor.unmount();
  });

  it("빈 일반 줄에 제목을 붙여넣으면 기존처럼 제목 블록이 된다", () => {
    const editor = mount([{ type: "paragraph", content: "" }]);
    editor.setTextCursorPosition(editor.document[0], "end");
    paste(editor, { "text/html": "<h2>제목</h2>", "text/plain": "제목" });

    expect(editor.document[0]).toMatchObject({ type: "heading", props: { level: 2 }, content: [{ type: "text", text: "제목" }] });
    editor.unmount();
  });

  it("여러 블록을 붙여넣으면 토글 줄에도 기존처럼 블록으로 넣는다", () => {
    const editor = mount([{ type: "toggleListItem", content: "" }]);
    editor.setTextCursorPosition(editor.document[0], "end");
    paste(editor, { "text/html": "<h2>제목</h2><p>본문</p>", "text/plain": "제목\n본문" });

    expect(editor.document.map((b) => Array.isArray(b.content) ? b.content.map((c) => ("text" in c ? c.text : "")).join("") : ""))
      .toEqual(expect.arrayContaining(["제목", "본문"]));
    editor.unmount();
  });

  // 글줄 시작 위치 목록 (문서 순서)
  function lineStarts(editor: BlockNoteEditor<any, any, any>) {
    const starts: number[] = [];
    editor.prosemirrorView!.state.doc.descendants((node, pos) => {
      if (node.isTextblock) starts.push(pos + 1);
    });
    return starts;
  }

  it("제목부터 아래 토글 첫머리까지 드래그해 복사한 뒤 토글에 붙여도 토글이 갈라지지 않는다", () => {
    const editor = mount([
      { type: "heading", props: { level: 2 }, content: "제목" },
      { type: "toggleListItem", content: "토글", children: [{ type: "paragraph", content: "안의 글" }] },
    ]);
    const view = editor.prosemirrorView!;
    const [headingStart, toggleStart] = lineStarts(editor);
    // 드래그가 아래 토글 줄 첫머리까지 걸쳐 빈 토글 조각이 함께 복사되는 선택
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, headingStart, toggleStart)));
    const copied = copy(editor);
    editor.setTextCursorPosition(editor.document[1], "end");
    paste(editor, copied);

    expect(editor.document).toHaveLength(2);
    expect(editor.document[1]).toMatchObject({
      type: "toggleListItem",
      content: [{ type: "text", text: "토글제목" }],
      children: [{ type: "paragraph", content: [{ type: "text", text: "안의 글" }] }],
    });
    editor.unmount();
  });

  it("윗줄 끝에서부터 드래그해 복사한 제목도 빈 앞 조각 없이 붙인다", () => {
    const editor = mount([
      { type: "paragraph", content: "위" },
      { type: "heading", props: { level: 2 }, content: "제목" },
      { type: "toggleListItem", content: "토글", children: [{ type: "paragraph", content: "안의 글" }] },
    ]);
    const view = editor.prosemirrorView!;
    const [aboveStart, headingStart] = lineStarts(editor);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, aboveStart + 1, headingStart + 2)));
    const copied = copy(editor);
    editor.setTextCursorPosition(editor.document[2], "end");
    paste(editor, copied);

    expect(editor.document).toHaveLength(3);
    expect(editor.document[2]).toMatchObject({
      type: "toggleListItem",
      content: [{ type: "text", text: "토글제목" }],
      children: [{ type: "paragraph", content: [{ type: "text", text: "안의 글" }] }],
    });
    editor.unmount();
  });
});
