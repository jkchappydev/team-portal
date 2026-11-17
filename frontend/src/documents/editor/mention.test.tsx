import { BlockNoteEditor } from "@blocknote/core";
import { blocksToYXmlFragment, yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { FRAGMENT_NAME } from "../collab";
import { filterMentionCandidates } from "./mentionCandidates";
import { editorSchema } from "./schema";

describe("@멘션 인라인 요소", () => {
  // 협업 서버(collab/src/extractText.ts)는 nodeName "mention" XmlElement의 memberId·name 속성을 읽음
  it("Yjs에는 memberId·name 속성을 가진 mention 요소로 저장되고 다시 읽힌다", () => {
    const editor = BlockNoteEditor.create({ schema: editorSchema });
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment(FRAGMENT_NAME);
    blocksToYXmlFragment(editor, [{
      type: "paragraph",
      content: [{ type: "text", text: "확인 ", styles: {} }, { type: "mention", props: { memberId: 3, name: "홍길동" } }],
    }] as never, fragment);

    const mentions: Y.XmlElement[] = [];
    const walk = (node: Y.XmlElement | Y.XmlFragment) => node.forEach((child) => {
      if (child instanceof Y.XmlElement) {
        if (child.nodeName === "mention") mentions.push(child);
        walk(child);
      }
    });
    walk(fragment);

    expect(mentions).toHaveLength(1);
    expect(Number(mentions[0].getAttribute("memberId"))).toBe(3);
    expect(mentions[0].getAttribute("name")).toBe("홍길동");

    const [block] = yXmlFragmentToBlocks(editor, fragment) as { content: { type: string; props?: object }[] }[];
    expect(block.content[1]).toMatchObject({ type: "mention", props: { memberId: 3, name: "홍길동" } });
  });
});

describe("filterMentionCandidates", () => {
  const members = [{ id: 1, name: "홍길동" }, { id: 2, name: "김철수" }, { id: 3, name: "Kim" }];

  it("빈 검색어면 전체, 이름 일부로 거르고 영문은 대소문자를 가리지 않는다", () => {
    expect(filterMentionCandidates(members, "")).toHaveLength(3);
    expect(filterMentionCandidates(members, "길").map((m) => m.id)).toEqual([1]);
    expect(filterMentionCandidates(members, "kim").map((m) => m.id)).toEqual([3]);
  });
});
