import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";
import { deleteEmptyLineForward, liftCalloutTitle, mergeHeadingUp } from "./calloutBackspace";

const p = (text: string) => ({ type: "paragraph" as const, content: text });
const text = (block: { content?: unknown }) =>
  Array.isArray(block.content) ? block.content.map((c: { text: string }) => c.text).join("") : "";

// 만든 편집기는 테스트마다 해제 (DOM 감시 타이머가 테스트 환경 종료 뒤 돌면 document 없음 오류로 CI 실패)
const mounted: { unmount: () => void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((editor) => editor.unmount());
});

function editorWith(children: unknown[], above: unknown = p("위")) {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [above, { type: "callout", children }] as never,
  });
  // 테스트에서는 편집 화면 없이 선택만 옮김
  editor.mount(document.createElement("div"));
  mounted.push(editor);
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

describe("제목 맨 앞 Backspace", () => {
  function editorOf(content: unknown[]) {
    const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: content as never });
    editor.mount(document.createElement("div"));
    mounted.push(editor);
    return editor;
  }

  // 예전에는 제목 스타일만 지워지고 한 번 더 눌러야 위 줄과 합쳐졌음
  it("바로 위 줄 끝에 이어 붙이고 위 줄 형식을 따르며, 커서는 이어 붙인 자리", () => {
    const editor = editorOf([p("테스트"), { type: "heading", props: { level: 2 }, content: "테스트2" }, p("아래")]);
    editor.setTextCursorPosition(editor.document[1].id, "start");
    expect(mergeHeadingUp(editor)).toBe(true);
    expect(editor.document.map((b) => [b.type, text(b)])).toEqual([["paragraph", "테스트테스트2"], ["paragraph", "아래"]]);
    expect(editor.getTextCursorPosition().block.id).toBe(editor.document[0].id);
    expect(caretOffset(editor)).toBe(3);
  });

  it("위 줄이 빈 줄이면 빈 줄만 지우고 제목 형식은 그대로 둔다", () => {
    const editor = editorOf([p("위"), { type: "paragraph" }, { type: "heading", props: { level: 3 }, content: "테스트3" }]);
    editor.setTextCursorPosition(editor.document[2].id, "start");
    expect(mergeHeadingUp(editor)).toBe(true);
    expect(editor.document.map((b) => [b.type, text(b)])).toEqual([["paragraph", "위"], ["heading", "테스트3"]]);
    expect(editor.document[1].props).toMatchObject({ level: 3 });
    expect(editor.getTextCursorPosition().block.id).toBe(editor.document[1].id);
    expect(caretOffset(editor)).toBe(0);
  });

  it("위 줄이 펼쳐진 하위 블록을 가지면 그 마지막 하위 줄에 이어 붙인다", () => {
    const editor = editorOf([{ type: "bulletListItem", content: "목록", children: [p("하위")] }, { type: "heading", props: { level: 2 }, content: "제목" }]);
    editor.setTextCursorPosition(editor.document[1].id, "start");
    expect(mergeHeadingUp(editor)).toBe(true);
    expect(editor.document).toHaveLength(1);
    expect(editor.document[0].children.map(text)).toEqual(["하위제목"]);
  });

  it("맨 앞이 아니거나, 위 줄이 없거나, 제목이 아니면 기본 동작에 맡긴다", () => {
    const editor = editorOf([{ type: "heading", props: { level: 2 }, content: "첫 제목" }, p("문단")]);
    editor.setTextCursorPosition(editor.document[0].id, "start");
    expect(mergeHeadingUp(editor)).toBe(false);
    editor.setTextCursorPosition(editor.document[1].id, "start");
    expect(mergeHeadingUp(editor)).toBe(false);
    editor.setTextCursorPosition(editor.document[0].id, "end");
    expect(mergeHeadingUp(editor)).toBe(false);
  });
});

describe("빈 줄에서 Delete", () => {
  function editorOf(content: unknown[]) {
    const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: content as never });
    editor.mount(document.createElement("div"));
    mounted.push(editor);
    return editor;
  }

  // 예전에는 아래 제목 글이 빈 문단으로 끌려와 제목 형식이 풀렸음
  it("빈 줄만 지우고 아래 제목 형식은 그대로 두며, 커서는 아래 줄 맨 앞", () => {
    const editor = editorOf([{ type: "paragraph" }, { type: "heading", props: { level: 2 }, content: "제목" }]);
    editor.setTextCursorPosition(editor.document[0].id, "start");
    expect(deleteEmptyLineForward(editor)).toBe(true);
    expect(editor.document.map((b) => [b.type, text(b)])).toEqual([["heading", "제목"]]);
    expect(editor.document[0].props).toMatchObject({ level: 2 });
    expect(editor.getTextCursorPosition().block.id).toBe(editor.document[0].id);
    expect(caretOffset(editor)).toBe(0);
  });

  it("글이 있는 줄이거나 아래 줄이 없으면 기본 동작에 맡긴다", () => {
    const editor = editorOf([p("글"), { type: "heading", props: { level: 2 }, content: "제목" }, { type: "paragraph" }]);
    editor.setTextCursorPosition(editor.document[0].id, "end");
    expect(deleteEmptyLineForward(editor)).toBe(false);
    editor.setTextCursorPosition(editor.document[2].id, "start");
    expect(deleteEmptyLineForward(editor)).toBe(false);
  });
});
