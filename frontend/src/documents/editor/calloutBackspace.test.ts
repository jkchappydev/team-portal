import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";
import { liftCalloutTitle } from "./calloutBackspace";

const p = (text: string) => ({ type: "paragraph" as const, content: text });
const text = (block: { content?: unknown }) =>
  Array.isArray(block.content) ? block.content.map((c: { text: string }) => c.text).join("") : "";

function editorWith(children: unknown[], above: unknown = p("위")) {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [above, { type: "callout", children }] as never,
  });
  // 테스트에서는 편집 화면 없이 선택만 옮김
  editor.mount(document.createElement("div"));
  return editor;
}

const caretOffset = (editor: ReturnType<typeof editorWith>) => editor.prosemirrorState.selection.$from.parentOffset;

describe("콜아웃 제목 맨 앞 Backspace", () => {
  it("제목 글을 바로 위 줄 끝에 이어 붙이고 다음 줄이 새 제목이 된다 (커서는 이어 붙인 자리)", () => {
    const editor = editorWith([{ type: "heading", props: { level: 1 }, content: "제목" }, p("본문")]);
    editor.setTextCursorPosition(editor.document[1].children[0].id, "start");
    expect(liftCalloutTitle(editor)).toBe(true);
    expect(editor.document.map((b) => [b.type, text(b)])).toEqual([["paragraph", "위제목"], ["callout", ""]]);
    expect(editor.document[1].children.map(text)).toEqual(["본문"]);
    expect(editor.getTextCursorPosition().block.id).toBe(editor.document[0].id);
    expect(caretOffset(editor)).toBe(1);
  });

  it("이어 붙인 줄은 위 줄 형식(제목 단계·색)을 따른다", () => {
    const above = { type: "heading", props: { level: 2, textColor: "red" }, content: "ㅇㅇ" };
    const editor = editorWith([p("ㄹㄹ"), p("본문")], above);
    editor.setTextCursorPosition(editor.document[1].children[0].id, "start");
    liftCalloutTitle(editor);
    expect(editor.document[0]).toMatchObject({ type: "heading", props: { level: 2, textColor: "red" } });
    expect(text(editor.document[0])).toBe("ㅇㅇㄹㄹ");
  });

  it("위 블록에 하위 줄이 있으면 화면상 바로 위인 마지막 하위 줄에 이어 붙인다", () => {
    const above = { type: "bulletListItem", content: "부모", children: [p("자식")] };
    const editor = editorWith([p("제목"), p("본문")], above);
    editor.setTextCursorPosition(editor.document[1].children[0].id, "start");
    liftCalloutTitle(editor);
    expect(editor.document[0].children.map(text)).toEqual(["자식제목"]);
  });

  it("위가 구분선 등 글 블록이 아니면 일반 문단으로 콜아웃 위에 꺼낸다", () => {
    const editor = editorWith([{ type: "heading", props: { level: 1 }, content: "제목" }], { type: "divider" });
    editor.setTextCursorPosition(editor.document[1].children[0].id, "start");
    liftCalloutTitle(editor);
    expect(editor.document.map((b) => [b.type, text(b)])).toEqual([["divider", ""], ["paragraph", "제목"]]);
  });

  it("줄이 하나뿐인 콜아웃은 위 줄에 이어 붙이고 콜아웃을 지운다", () => {
    const editor = editorWith([p("한줄")]);
    editor.setTextCursorPosition(editor.document[1].children[0].id, "start");
    expect(liftCalloutTitle(editor)).toBe(true);
    expect(editor.document.map((b) => [b.type, text(b)])).toEqual([["paragraph", "위한줄"]]);
  });

  it("제목 중간이거나 본문 줄이면 기본 Backspace에 맡긴다", () => {
    const editor = editorWith([p("제목"), p("본문")]);
    const [title, body] = editor.document[1].children;
    editor.setTextCursorPosition(title.id, "end");
    expect(liftCalloutTitle(editor)).toBe(false);
    editor.setTextCursorPosition(body.id, "start");
    expect(liftCalloutTitle(editor)).toBe(false);
  });
});
