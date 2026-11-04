import * as Y from "yjs";

// 블록 단위로 줄바꿈을 넣어 검색용 평문 추출
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
    const isBlock = node instanceof Y.XmlElement && node.nodeName === "blockContainer";
    if (isBlock && parts.length > 0 && !parts[parts.length - 1].endsWith("\n")) {
      parts.push("\n");
    }
    node.forEach((child) => walk(child as Y.XmlElement));
  };

  walk(doc.getXmlFragment("document-store"));
  return parts.join("").trim();
}
