import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";
import { isOutsideTable, NEW_CALLOUT } from "./calloutCommand";

describe("콜아웃 블록", () => {
  it("새 콜아웃은 💡 아이콘·회색 배경이고 안에 빈 줄 하나를 담는다", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: [NEW_CALLOUT] });
    const block = editor.document[0];
    expect(block.type).toBe("callout");
    expect(block.props).toMatchObject({ icon: "💡", backgroundColor: "gray" });
    expect(block.children.map((child) => child.type)).toEqual(["paragraph"]);
  });

  // 안의 글은 일반 블록이라 슬래시 메뉴로 다른 형식으로 바꿔도 콜아웃 안에 남음 (버그 재발 방지)
  it("콜아웃 안의 줄을 제목으로 바꿔도 콜아웃 안에 남는다", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "callout", children: [{ type: "paragraph", content: "첫 줄" }, { type: "paragraph" }] }],
    });
    editor.updateBlock(editor.document[0].children[1], { type: "heading", props: { level: 1 } });
    const callout = editor.document[0];
    expect(callout.type).toBe("callout");
    expect(callout.children.map((child) => child.type)).toEqual(["paragraph", "heading"]);
  });

  it("아이콘과 배경색을 바꿀 수 있다", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: [NEW_CALLOUT] });
    editor.updateBlock(editor.document[0], { props: { icon: "📌", backgroundColor: "blue" } });
    expect(editor.document[0].props).toMatchObject({ icon: "📌", backgroundColor: "blue" });
  });

  it("HTML·Markdown 내보내기에서는 아이콘 인용문 뒤에 안의 글이 이어진다", async () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "callout", props: { icon: "📌" }, children: [{ type: "paragraph", content: "메모" }] }],
    });
    const html = await editor.blocksToHTMLLossy(editor.document);
    expect(html).toContain("<blockquote");
    expect(html).toContain("📌");
    expect(html).toContain("메모");
    expect(await editor.blocksToMarkdownLossy(editor.document)).toContain("📌");
  });
});

describe("isOutsideTable", () => {
  // 커서 위치 조상 노드 이름 목록으로 가짜 트랜잭션을 만듦 (depth 1부터)
  const at = (...names: string[]) => ({
    selection: { $from: { depth: names.length, node: (depth: number) => ({ type: { name: names[depth - 1] } }) } },
  });

  it("표 칸 안에서는 슬래시 메뉴를 열지 않는다", () => {
    expect(isOutsideTable(at("blockGroup", "blockContainer", "table", "tableRow", "tableCell", "tableParagraph"))).toBe(false);
  });

  it("일반 줄과 콜아웃 안 줄에서는 연다", () => {
    expect(isOutsideTable(at("blockGroup", "blockContainer", "paragraph"))).toBe(true);
    expect(isOutsideTable(at("blockGroup", "blockContainer", "blockGroup", "blockContainer", "paragraph"))).toBe(true);
  });
});
