import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";

describe("코드 서식", () => {
  it("코드 글자에 굵게·기울임·밑줄·취소선·글자색·배경색을 함께 줄 수 있다", () => {
    const styles = {
      code: true, bold: true, italic: true, underline: true, strike: true, textColor: "blue", backgroundColor: "yellow",
    };
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "paragraph", content: [{ type: "text", text: "코드", styles }] }],
    });
    expect(editor.document[0].content).toEqual([{ type: "text", text: "코드", styles }]);
  });

  it("코드 글자에 링크를 걸 수 있다", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{
        type: "paragraph",
        content: [{ type: "link", href: "https://example.com", content: [{ type: "text", text: "코드", styles: { code: true } }] }],
      }],
    });
    expect(editor.document[0].content).toEqual([{
      type: "link", href: "https://example.com", content: [{ type: "text", text: "코드", styles: { code: true } }],
    }]);
  });
});
