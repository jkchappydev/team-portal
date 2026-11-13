import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";
import { addPlainBlockBelow } from "./NotionSideMenu";

describe("+ 버튼 (새 줄 넣은 뒤 스타일 메뉴는 컴포넌트에서 엶)", () => {
  it("항상 바로 아래에 일반 텍스트 줄을 새로 넣고 커서를 옮긴다 (제목·콜아웃 아래도 문단)", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [
        { type: "heading", props: { level: 1 }, content: "제목" },
        { type: "callout", children: [{ type: "paragraph", content: "안" }] } as never,
      ],
    });
    editor.mount(document.createElement("div"));
    const [heading, callout] = editor.document;
    addPlainBlockBelow(editor, heading.id);
    expect(editor.document.map((b) => b.type)).toEqual(["heading", "paragraph", "callout"]);
    expect(editor.getTextCursorPosition().block.id).toBe(editor.document[1].id);
    addPlainBlockBelow(editor, callout.id);
    expect(editor.document.map((b) => b.type)).toEqual(["heading", "paragraph", "callout", "paragraph"]);
  });
});
