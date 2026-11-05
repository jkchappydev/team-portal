import { BlockNoteEditor } from "@blocknote/core";
import { blocksToYDoc, blocksToYXmlFragment, yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { FRAGMENT_NAME } from "../collab";
import { TABLE_OPTIONS } from "../collabSession";
import { bytesToBase64, versionToBlocks } from "./versionContent";

const paragraph = (text: string) => ({ type: "paragraph" as const, content: text });

function texts(blocks: { content?: unknown }[]): string[] {
  return blocks.map((b) => (b.content as { text: string }[]).map((c) => c.text).join(""));
}

describe("versionContent (실제 BlockNote·Yjs)", () => {
  it("저장된 사본을 편집기 블록으로 되살린다", async () => {
    const editor = BlockNoteEditor.create({ tables: TABLE_OPTIONS });
    const doc = blocksToYDoc(editor, [paragraph("첫 줄"), paragraph("둘째 줄")], FRAGMENT_NAME);

    const blocks = await versionToBlocks(bytesToBase64(Y.encodeStateAsUpdate(doc)));

    expect(texts(blocks)).toEqual(["첫 줄", "둘째 줄"]);
  });

  it("되돌리기에 쓰는 blocksToYXmlFragment는 기존 본문 뒤에 덧붙이지 않고 그 버전 내용으로 바꾼다", () => {
    const editor = BlockNoteEditor.create({ tables: TABLE_OPTIONS });
    const live = blocksToYDoc(editor, [paragraph("지금 본문 1"), paragraph("지금 본문 2"), paragraph("지금 본문 3")], FRAGMENT_NAME);
    const fragment = live.getXmlFragment(FRAGMENT_NAME);

    blocksToYXmlFragment(editor, [paragraph("예전 본문")] as never, fragment);

    expect(texts(yXmlFragmentToBlocks(editor, fragment))).toEqual(["예전 본문"]);
  });
});
