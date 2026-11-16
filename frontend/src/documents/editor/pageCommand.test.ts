import { describe, expect, it, vi } from "vitest";
import { appendMissingPageBlocks, placePageBlock, referencedPageIds } from "./pageCommand";
import type { PageBlockNode, PageEditor } from "./pageCommand";

function fakeEditor(document: PageBlockNode[]): PageEditor {
  const ids = (blocks: PageBlockNode[]): string[] => blocks.flatMap((b) => [b.id, ...ids(b.children ?? [])]);
  return {
    getBlock: (id: string) => (ids(document).includes(id) ? { id } : undefined),
    updateBlock: vi.fn(),
    insertBlocks: vi.fn(),
    document,
  };
}

const pageBlock = (documentId: number) => ({ type: "page", props: { documentId } });

describe("placePageBlock", () => {
  it("빈 줄에서 /페이지를 고르면 그 줄을 페이지 블록으로 바꾼다", () => {
    const editor = fakeEditor([{ id: "a" }, { id: "b" }]);
    placePageBlock(editor, { id: "b", content: [] }, 7);
    expect(editor.updateBlock).toHaveBeenCalledWith({ id: "b", content: [] }, pageBlock(7));
  });

  it("글자가 있는 줄이면 그 아래에 넣고, 그 줄이 사라졌으면 맨 끝에 넣는다", () => {
    const editor = fakeEditor([{ id: "a" }, { id: "c" }]);
    const written = { id: "a", content: [{ type: "text", text: "회의" }] };
    placePageBlock(editor, written, 7);
    expect(editor.insertBlocks).toHaveBeenCalledWith([pageBlock(7)], written, "after");
    placePageBlock(editor, { id: "gone", content: [] }, 8);
    expect(editor.insertBlocks).toHaveBeenLastCalledWith([pageBlock(8)], { id: "c" }, "after");
  });
});

describe("appendMissingPageBlocks", () => {
  it("본문에 아직 없는 페이지만 주어진 순서대로 맨 끝에 붙인다 (콜아웃 안에 이미 있는 블록도 건너뜀)", () => {
    const last = { id: "z" };
    const editor = fakeEditor([
      { id: "x", type: "callout", children: [{ id: "y", type: "page", props: { documentId: 12 } }] },
      last,
    ]);
    expect(appendMissingPageBlocks(editor, [11, 12, 13])).toEqual([11, 13]);
    expect(editor.insertBlocks).toHaveBeenCalledWith([pageBlock(11), pageBlock(13)], last, "after");
  });

  it("붙일 것이 없으면 아무것도 넣지 않는다", () => {
    const editor = fakeEditor([{ id: "p", type: "page", props: { documentId: 5 } }]);
    expect(appendMissingPageBlocks(editor, [5])).toEqual([]);
    expect(appendMissingPageBlocks(editor, [])).toEqual([]);
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });
});

describe("referencedPageIds", () => {
  it("중첩된 블록까지 페이지 블록이 가리키는 문서 ID를 모은다", () => {
    expect(referencedPageIds([
      { id: "a", type: "page", props: { documentId: 1 } },
      { id: "b", type: "paragraph", children: [{ id: "c", type: "page", props: { documentId: 2 } }] },
      { id: "d", type: "schedule", props: { documentId: 3 } },
    ])).toEqual(new Set([1, 2]));
  });
});
