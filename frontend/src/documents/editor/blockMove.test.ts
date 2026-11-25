import { BlockNoteEditor } from "@blocknote/core";
import { blocksToYXmlFragment, yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import { editorSchema } from "./schema";
import { appendBlocksToFragment, isPageMoved, markPagesMoved, moveBlocksToPage } from "./blockMove";

const text = (id: string, value: string) => ({ id, type: "paragraph", props: {}, content: [{ type: "text", text: value, styles: {} }], children: [] });
const page = (id: string, documentId: number) => ({ id, type: "page", props: { documentId }, children: [] });

function setup() {
  const order: string[] = [];
  const actions = {
    movePage: vi.fn(async (pageId: number, target: number) => { order.push(`move ${pageId}→${target}`); }),
    appendBlocks: vi.fn(async (target: number) => { order.push(`append ${target}`); }),
    removeBlocks: vi.fn(() => { order.push("remove"); }),
  };
  return { order, actions };
}

describe("moveBlocksToPage", () => {
  it("블록 안의 페이지를 먼저 대상 아래로 옮기고, 대상 본문에 덧붙인 뒤 지금 본문에서 지운다", async () => {
    const { order, actions } = setup();
    await moveBlocksToPage({ blocks: [text("a", "글"), { ...text("b", "목록"), children: [page("p", 7)] }], sourceDocumentId: 1, targetDocumentId: 5 }, actions);
    expect(order).toEqual(["move 7→5", "append 5", "remove"]);
    // 지운 블록의 페이지는 휴지통으로 보내지 않음
    expect(isPageMoved(7)).toBe(true);
  });

  it("덧붙이기에 실패하면 옮긴 페이지를 원래 페이지 아래로 되돌리고 본문은 지우지 않는다", async () => {
    const { order, actions } = setup();
    actions.appendBlocks.mockRejectedValueOnce(new Error("본문에 접속하지 못했습니다."));
    await expect(moveBlocksToPage({ blocks: [page("p", 7), page("q", 8)], sourceDocumentId: 1, targetDocumentId: 5 }, actions))
      .rejects.toThrow("본문에 접속하지 못했습니다.");
    expect(order).toEqual(["move 7→5", "move 8→5", "move 8→1", "move 7→1"]);
    expect(actions.removeBlocks).not.toHaveBeenCalled();
  });

  it("서버가 페이지 이동을 거절하면(하위 페이지 안 등) 그 앞에 옮긴 페이지만 되돌린다", async () => {
    const { order, actions } = setup();
    actions.movePage.mockImplementation(async (pageId: number, target: number) => {
      if (pageId === 8 && target === 5) throw new Error("하위 페이지 안으로는 옮길 수 없습니다.");
      order.push(`move ${pageId}→${target}`);
    });
    await expect(moveBlocksToPage({ blocks: [page("p", 7), page("q", 8)], sourceDocumentId: 1, targetDocumentId: 5 }, actions))
      .rejects.toThrow("하위 페이지 안으로는 옮길 수 없습니다.");
    expect(order).toEqual(["move 7→5", "move 7→1"]);
  });

  it("지금 페이지나 옮기는 블록 안의 페이지로는 옮기지 않는다", async () => {
    const { actions } = setup();
    await expect(moveBlocksToPage({ blocks: [text("a", "글")], sourceDocumentId: 1, targetDocumentId: 1 }, actions)).rejects.toThrow();
    await expect(moveBlocksToPage({ blocks: [page("p", 7)], sourceDocumentId: 1, targetDocumentId: 7 }, actions)).rejects.toThrow();
    expect(actions.movePage).not.toHaveBeenCalled();
    expect(actions.appendBlocks).not.toHaveBeenCalled();
  });

  it("옮긴 페이지 기억은 잠시 뒤 사라진다", () => {
    markPagesMoved([42], 1000);
    expect(isPageMoved(42, 1000 + 59_000)).toBe(true);
    expect(isPageMoved(42, 1000 + 61_000)).toBe(false);
  });
});

describe("appendBlocksToFragment", () => {
  const editor = BlockNoteEditor.create({ schema: editorSchema }) as unknown as BlockNoteEditor<any, any, any>;
  const read = (fragment: Y.XmlFragment) =>
    (yXmlFragmentToBlocks(editor, fragment) as { id: string; content: { text: string }[] }[]).map((b) => `${b.id}:${b.content[0]?.text ?? ""}`);

  it("기존 본문은 그대로 두고 맨 아래에 같은 id로 덧붙인다", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document-store");
    blocksToYXmlFragment(editor, [text("x", "원래 글")] as never, fragment);
    await appendBlocksToFragment(Y, editor, fragment, [text("a", "옮긴 글"), text("b", "둘째")]);
    expect(read(fragment)).toEqual(["x:원래 글", "a:옮긴 글", "b:둘째"]);
  });

  it("본문이 빈 줄 하나뿐이면 그 줄 대신 넣고, 아무것도 없으면 새로 쓴다", async () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("document-store");
    blocksToYXmlFragment(editor, [{ id: "e", type: "paragraph", content: [] }] as never, fragment);
    await appendBlocksToFragment(Y, editor, fragment, [text("a", "옮긴 글")]);
    expect(read(fragment)).toEqual(["a:옮긴 글"]);

    const empty = new Y.Doc().getXmlFragment("document-store");
    await appendBlocksToFragment(Y, editor, empty, [text("b", "새 글")]);
    expect(read(empty)).toEqual(["b:새 글"]);
  });
});
