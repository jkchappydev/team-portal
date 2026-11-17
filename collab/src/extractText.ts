import * as Y from "yjs";

// 본문 @멘션 인라인 요소 이름 (프런트 편집기 스키마의 mention)
const MENTION = "mention";

// 블록 단위로 줄바꿈을 넣어 검색용 평문 추출 (@멘션은 "@이름"으로)
export function extractText(doc: Y.Doc): string {
  const parts: string[] = [];

  const walk = (node: Y.XmlElement | Y.XmlText | Y.XmlFragment | Y.XmlHook) => {
    if (node instanceof Y.XmlText) {
      for (const op of node.toDelta()) {
        if (typeof op.insert === "string") {
          parts.push(op.insert);
        }
      }
      return;
    }
    if (!(node instanceof Y.XmlElement) && !(node instanceof Y.XmlFragment)) {
      return;
    }
    if (node instanceof Y.XmlElement && node.nodeName === MENTION) {
      const name = node.getAttribute("name");
      if (name) {
        parts.push(`@${String(name)}`);
      }
      return;
    }
    const isBlock = node instanceof Y.XmlElement && node.nodeName === "blockContainer";
    if (isBlock && parts.length > 0 && !parts[parts.length - 1].endsWith("\n")) {
      parts.push("\n");
    }
    node.forEach((child) => walk(child as Y.XmlElement));
  };

  walk(doc.getXmlFragment("document-store"));
  return parts.join("").trim();
}

// 본문에서 @로 언급한 팀원 ID 목록 (중복 제거, 잘못된 값 제외)
export function extractMentions(doc: Y.Doc): number[] {
  const ids = new Set<number>();

  const walk = (node: Y.XmlElement | Y.XmlText | Y.XmlFragment | Y.XmlHook) => {
    if (!(node instanceof Y.XmlElement) && !(node instanceof Y.XmlFragment)) {
      return;
    }
    if (node instanceof Y.XmlElement && node.nodeName === MENTION) {
      const id = Number(node.getAttribute("memberId"));
      if (Number.isInteger(id) && id > 0) {
        ids.add(id);
      }
      return;
    }
    node.forEach((child) => walk(child as Y.XmlElement));
  };

  walk(doc.getXmlFragment("document-store"));
  return [...ids];
}
