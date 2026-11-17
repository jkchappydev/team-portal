import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { extractMentions, extractText } from "./extractText.js";

// BlockNote 구조(blockGroup > blockContainer > paragraph > XmlText)를 흉내 내 문서 구성
function addBlock(group: Y.XmlElement, text: string, bold = false) {
  const container = new Y.XmlElement("blockContainer");
  const paragraph = new Y.XmlElement("paragraph");
  const xmlText = new Y.XmlText();
  container.insert(0, [paragraph]);
  paragraph.insert(0, [xmlText]);
  group.insert(group.length, [container]);
  xmlText.insert(0, text, bold ? { bold: true } : undefined);
}

function createDoc(build: (group: Y.XmlElement) => void): Y.Doc {
  const doc = new Y.Doc();
  const group = new Y.XmlElement("blockGroup");
  doc.getXmlFragment("document-store").insert(0, [group]);
  build(group);
  return doc;
}

describe("extractText", () => {
  it("블록 텍스트를 줄바꿈으로 이어 붙인다", () => {
    const doc = createDoc((group) => {
      addBlock(group, "배포 절차");
      addBlock(group, "1. 빌드");
    });
    expect(extractText(doc)).toBe("배포 절차\n1. 빌드");
  });

  it("빈 문서는 빈 문자열", () => {
    expect(extractText(new Y.Doc())).toBe("");
  });

  it("서식(굵게)이 있어도 텍스트만 추출", () => {
    const doc = createDoc((group) => addBlock(group, "중요 공지", true));
    expect(extractText(doc)).toBe("중요 공지");
  });
});

// 글 사이에 @멘션 요소가 끼인 문단 (y-prosemirror가 인라인 노드를 XmlElement로 저장하는 구조)
function addMentionBlock(group: Y.XmlElement, before: string, mentions: { memberId: unknown; name: string }[]) {
  const container = new Y.XmlElement("blockContainer");
  const paragraph = new Y.XmlElement("paragraph");
  container.insert(0, [paragraph]);
  group.insert(group.length, [container]);
  const text = new Y.XmlText();
  paragraph.insert(0, [text]);
  text.insert(0, before);
  for (const mention of mentions) {
    const element = new Y.XmlElement("mention");
    paragraph.insert(paragraph.length, [element]);
    element.setAttribute("memberId", mention.memberId as string);
    element.setAttribute("name", mention.name);
  }
}

describe("extractText @멘션", () => {
  it("멘션은 @이름으로 평문에 들어간다", () => {
    const doc = createDoc((group) => addMentionBlock(group, "확인 부탁 ", [{ memberId: 3, name: "홍길동" }]));
    expect(extractText(doc)).toBe("확인 부탁 @홍길동");
  });
});

describe("extractMentions", () => {
  it("언급한 팀원 ID를 중복 없이 모은다", () => {
    const doc = createDoc((group) => {
      addMentionBlock(group, "a ", [{ memberId: 3, name: "가" }, { memberId: "4", name: "나" }]);
      addMentionBlock(group, "b ", [{ memberId: 3, name: "가" }]);
    });
    expect(extractMentions(doc).sort()).toEqual([3, 4]);
  });

  it("잘못된 ID와 멘션 없는 문서는 빈 목록", () => {
    expect(extractMentions(createDoc((group) => addMentionBlock(group, "x", [{ memberId: 0, name: "?" }])))).toEqual([]);
    expect(extractMentions(new Y.Doc())).toEqual([]);
  });
});
