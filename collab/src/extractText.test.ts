import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { extractText } from "./extractText.js";

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
