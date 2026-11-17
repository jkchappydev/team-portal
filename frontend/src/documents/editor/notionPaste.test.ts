import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorPasteHandler, keepLineTypeOnPasteExtension } from "./paste";
import { NOTION_BLOCKS_TYPE, richTextToHtml } from "./notionPaste";
import { editorSchema } from "./schema";

// 실제 노션 복사 데이터와 같은 구조 (식별자는 가짜 값)
function notionClipboard(rootId: string, blocks: Record<string, unknown>[]) {
  const map = Object.fromEntries(blocks.map((block) => [block.id, { value: block }]));
  return JSON.stringify({ blocks: [{ blockId: rootId, blockSubtree: { __version__: 3, block: map } }], action: "copy" });
}

const CODE = [["c"]] as [string][];

// 칸 안에서 줄을 바꾼 표: 노션 HTML은 Markdown을 거치며 줄바꿈 뒤 글자가 다음 행 첫 칸으로 밀려 있음
const tableData = {
  "text/plain": "| 필드명 | 설명 | 대응 컬럼 및 참조 테이블 |\n| --- | --- | --- |\n| `authorInfo` | 저자 정보 | `book_author`\n`ecb_book_info_tbl` |",
  "text/html": "<html>\n<body>\n<!--StartFragment--><table>\n<thead>\n<tr>\n<th>필드명</th>\n<th>설명</th>\n<th>대응 컬럼 및 참조 테이블</th>\n</tr>\n</thead>\n<tbody>\n"
    + "<tr>\n<td><code>authorInfo</code></td>\n<td>저자 정보</td>\n<td><code>book_author</code></td>\n</tr>\n"
    + "<tr>\n<td><code>ecb_book_info_tbl</code></td>\n<td></td>\n<td></td>\n</tr>\n</tbody>\n</table>\n<!--EndFragment-->\n</body>\n</html>",
  [NOTION_BLOCKS_TYPE]: notionClipboard("t", [
    {
      id: "t", type: "table", content: ["r1", "r2"],
      format: { table_block_column_order: ["c1", "c2", "c3"], table_block_column_header: true },
    },
    { id: "r1", type: "table_row", properties: { c1: [["필드명"]], c2: [["설명"]], c3: [["대응 컬럼 및 참조 테이블"]] } },
    {
      id: "r2", type: "table_row",
      properties: { c1: [["authorInfo", CODE]], c2: [["저자 정보"]], c3: [["book_author", CODE], ["\n"], ["ecb_book_info_tbl", CODE]] },
    },
  ]),
};

// 콜아웃: 노션 HTML에는 "<aside>"가 글자로 들어 있음
const calloutData = {
  "text/plain": "<aside>\n💡\n\n1\n\n2\n\n</aside>",
  "text/html": "<html>\n<body>\n<!--StartFragment--><p>&lt;aside&gt;<br>\n💡</p>\n<p>1</p>\n<p>2</p>\n<p>&lt;/aside&gt;</p>\n<!--EndFragment-->\n</body>\n</html>",
  [NOTION_BLOCKS_TYPE]: notionClipboard("c", [
    { id: "c", type: "callout", content: ["p1", "p2"], format: { page_icon: "💡", block_color: "gray_background" } },
    { id: "p1", type: "text", properties: { title: [["1"]] } },
    { id: "p2", type: "text", properties: { title: [["2"]] } },
  ]),
};

describe("노션 붙여넣기", () => {
  beforeAll(() => {
    (globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??= class extends Event { clipboardData = null; };
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  function pasteInto(data: Record<string, string>) {
    const editor = BlockNoteEditor.create({ schema: editorSchema, pasteHandler: editorPasteHandler, extensions: [keepLineTypeOnPasteExtension] });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    event.clipboardData = { types: Object.keys(data), getData: (type: string) => data[type] ?? "" };
    editor.prosemirrorView!.dom.dispatchEvent(event);
    return editor;
  }

  it("칸 안에 줄바꿈이 있는 노션 표를 행이 밀리지 않게 붙여넣는다", () => {
    const editor = pasteInto(tableData);
    const table = editor.document.find((block) => block.type === "table")!;
    const content = table.content as unknown as { headerRows?: number; rows: { cells: { content: { text: string; styles: Record<string, unknown> }[] }[] }[] };

    expect(content.rows).toHaveLength(2);
    expect(content.headerRows).toBe(1);
    expect(content.rows[1].cells[2].content).toEqual([
      { type: "text", text: "book_author\necb_book_info_tbl", styles: { code: true } },
    ].map(({ text, styles }) => expect.objectContaining({ text, styles })));
    expect(content.rows[1].cells[0].content).toEqual([expect.objectContaining({ text: "authorInfo", styles: { code: true } })]);
    editor.unmount();
  });

  it("노션 콜아웃을 아이콘·색을 살린 콜아웃 블록으로 붙여넣는다", () => {
    const editor = pasteInto(calloutData);
    const callout = editor.document.find((block) => block.type === "callout")!;

    expect(callout).toBeDefined();
    expect(callout.props).toMatchObject({ icon: "💡", backgroundColor: "gray" });
    expect(callout.children.map((child) => (child.content as { text: string }[]).map((c) => c.text).join(""))).toEqual(["1", "2"]);
    expect(JSON.stringify(editor.document)).not.toContain("aside");
    editor.unmount();
  });

  it("아이콘과 같은 줄에 글이 있는 콜아웃도 첫 글을 남긴다", () => {
    const editor = pasteInto({
      ...calloutData,
      "text/html": "<p>&lt;aside&gt;<br>\n💡 첫 줄</p>\n<p>둘째 줄 &lt;/aside&gt;</p>",
    });
    const callout = editor.document.find((block) => block.type === "callout")!;

    expect(callout.children.map((child) => (child.content as { text: string }[]).map((c) => c.text).join(""))).toEqual(["첫 줄", "둘째 줄"]);
    editor.unmount();
  });

  it("표·콜아웃이 없는 노션 복사는 기존 붙여넣기를 그대로 쓴다", () => {
    const editor = pasteInto({
      "text/plain": "글",
      "text/html": "<p>글</p>",
      [NOTION_BLOCKS_TYPE]: notionClipboard("p", [{ id: "p", type: "text", properties: { title: [["글"]] } }]),
    });
    expect(editor.document[0]).toMatchObject({ type: "paragraph", content: [{ type: "text", text: "글" }] });
    editor.unmount();
  });
});

describe("richTextToHtml", () => {
  it("노션 서식(굵게·코드·링크·색)과 줄바꿈을 HTML로 바꾼다", () => {
    expect(richTextToHtml([["굵게", [["b"]]], ["\n"], ["<코드>", [["c"]]], ["링크", [["a", "https://example.com"]]], ["빨강", [["h", "red_background"]]]]))
      .toBe('<strong>굵게</strong><br><code>&lt;코드&gt;</code><a href="https://example.com">링크</a><span class="highlight-red_background">빨강</span>');
  });
});
