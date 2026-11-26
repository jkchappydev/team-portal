import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { blockHostId, detachTrashedPage, fragmentHasPageBlock, removePageBlocksFromFragment } from "./pageBlockSync";

// 협업 서버 대신 메모리 본문에 접속한 것처럼 처리
const session = vi.hoisted(() => ({ hostIds: [] as number[], fragment: null as unknown }));
vi.mock("../collabSession", () => ({
  withSyncedDocument: async (id: number, work: (s: unknown) => unknown) => {
    session.hostIds.push(id);
    return work({ fragment: session.fragment, provider: {} });
  },
  waitUntilSynced: () => Promise.resolve(),
}));

// 편집기가 저장하는 본문 구조와 같은 모양으로 만듦 (blockGroup > blockContainer > 블록 [+ 하위 blockGroup])
type Spec = { page?: number; text?: string; children?: Spec[] };

function container(spec: Spec, index: number): Y.XmlElement {
  const el = new Y.XmlElement("blockContainer");
  el.setAttribute("id", `b${index}-${spec.page ?? spec.text}`);
  const content = new Y.XmlElement(spec.page !== undefined ? "page" : "paragraph");
  if (spec.page !== undefined) content.setAttribute("documentId", spec.page as never);
  else content.insert(0, [new Y.XmlText(spec.text ?? "")]);
  el.insert(0, [content]);
  if (spec.children) el.insert(1, [group(spec.children)]);
  return el;
}

function group(specs: Spec[]): Y.XmlElement {
  const el = new Y.XmlElement("blockGroup");
  el.insert(0, specs.map(container));
  return el;
}

function fragmentOf(specs: Spec[]): Y.XmlFragment {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("document-store");
  fragment.insert(0, [group(specs)]);
  return fragment;
}

// 남은 블록을 순서대로 (page:ID 또는 문단 글자)
function outline(fragment: Y.XmlFragment): string[] {
  const out: string[] = [];
  const walk = (node: Y.XmlElement | Y.XmlFragment, depth: number) => {
    for (const child of node.toArray()) {
      if (!(child instanceof Y.XmlElement)) continue;
      if (child.nodeName === "blockContainer") {
        const content = child.get(0) as Y.XmlElement;
        out.push(`${"-".repeat(depth)}${content.nodeName === "page" ? `page:${content.getAttribute("documentId")}` : content.toArray().join("")}`);
        const nested = child.get(1);
        if (nested instanceof Y.XmlElement) walk(nested, depth + 1);
      } else {
        walk(child, depth);
      }
    }
  };
  walk(fragment, 0);
  return out;
}

describe("pageBlockSync", () => {
  it("지운 페이지를 가리키는 블록만 빼고 나머지는 그대로 둔다", () => {
    const fragment = fragmentOf([{ text: "위" }, { page: 3 }, { page: 4 }, { text: "아래" }]);
    expect(removePageBlocksFromFragment(fragment, 3)).toBe(1);
    expect(outline(fragment)).toEqual(["위", "page:4", "아래"]);
  });

  it("콜아웃·토글처럼 다른 블록 안에 들어간 페이지 블록도 뺀다", () => {
    const fragment = fragmentOf([{ text: "묶음", children: [{ page: 3 }, { text: "안쪽" }] }]);
    expect(removePageBlocksFromFragment(fragment, 3)).toBe(1);
    expect(outline(fragment)).toEqual(["묶음", "-안쪽"]);
  });

  it("페이지 블록 아래에 들여쓴 블록은 지우지 않고 그 자리로 올린다", () => {
    const fragment = fragmentOf([{ page: 3, children: [{ text: "딸린 줄" }] }, { text: "다음" }]);
    removePageBlocksFromFragment(fragment, 3);
    expect(outline(fragment)).toEqual(["딸린 줄", "다음"]);
  });

  it("같은 페이지 블록이 여러 개면 모두 빼고, 없으면 아무것도 바꾸지 않는다", () => {
    const fragment = fragmentOf([{ page: 3 }, { text: "사이" }, { page: 3 }]);
    expect(removePageBlocksFromFragment(fragment, 3)).toBe(2);
    expect(outline(fragment)).toEqual(["사이"]);
    expect(removePageBlocksFromFragment(fragment, 9)).toBe(0);
    expect(outline(fragment)).toEqual(["사이"]);
  });

  it("본문 어디에든 그 페이지 블록이 있는지 안다 (문자·숫자로 저장된 ID 모두)", () => {
    const fragment = fragmentOf([{ text: "묶음", children: [{ page: 4 }] }]);
    expect(fragmentHasPageBlock(fragment, 4)).toBe(true);
    expect(fragmentHasPageBlock(fragment, 3)).toBe(false);
    // 문서에 넣은 뒤에야 하위 노드를 읽을 수 있음
    const textId = fragmentOf([{ page: 0 }]);
    const page = ((textId.get(0) as Y.XmlElement).get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    page.setAttribute("documentId", "7");
    expect(fragmentHasPageBlock(textId, 7)).toBe(true);
  });

  it("페이지 블록이 들어 있는 본문은 상위 페이지, 상위가 없으면 프로젝트 본문", () => {
    const spaces = [{ id: 2, homeDocumentId: 20 }];
    expect(blockHostId({ parentId: 5, spaceId: 2 }, spaces)).toBe(5);
    expect(blockHostId({ parentId: null, spaceId: 2 }, spaces)).toBe(20);
    expect(blockHostId({ parentId: null, spaceId: 9 }, spaces)).toBeNull();
  });

  it("휴지통으로 보낸 페이지의 블록을 상위 본문에서 빼고, 상위가 없으면 프로젝트 본문에서 뺀다", async () => {
    session.hostIds = [];
    session.fragment = fragmentOf([{ page: 3 }, { text: "남는 줄" }]);
    await detachTrashedPage({ id: 3, parentId: null, spaceId: 2 }, () => Promise.resolve([{ id: 2, homeDocumentId: 20 }]));
    expect(session.hostIds).toEqual([20]);
    expect(outline(session.fragment as Y.XmlFragment)).toEqual(["남는 줄"]);

    session.fragment = fragmentOf([{ page: 4 }]);
    await detachTrashedPage({ id: 4, parentId: 3, spaceId: 2 }, () => Promise.resolve([]));
    expect(session.hostIds).toEqual([20, 3]);
  });

  it("상위 본문에서 빼지 못해도 오류를 던지지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(detachTrashedPage({ id: 3, parentId: null, spaceId: 2 }, () => Promise.reject(new Error("실패")))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
