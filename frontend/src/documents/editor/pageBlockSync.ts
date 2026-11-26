import type * as YType from "yjs";

// 페이지를 휴지통으로 보내거나 복원할 때, 그 페이지를 가리키는 상위 본문의 페이지 블록도 함께 빼고 붙임 (노션과 같은 동작)
// 본문 구조: blockGroup > blockContainer > (블록 하나 [+ 하위 blockGroup])

type XmlNode = YType.XmlElement | YType.XmlText | YType.XmlHook;
type XmlParent = YType.XmlElement | YType.XmlFragment;

function isElement(node: XmlNode | undefined): node is YType.XmlElement {
  return !!node && typeof (node as YType.XmlElement).nodeName === "string" && typeof (node as YType.XmlElement).getAttribute === "function";
}

// blockContainer의 첫 블록이 이 페이지를 가리키는 페이지 블록인지 (ID는 숫자·문자 어느 쪽으로 저장돼도 같게 봄)
function isPageContainer(node: XmlNode, pageId: number): node is YType.XmlElement {
  if (!isElement(node) || node.nodeName !== "blockContainer") return false;
  const content = node.get(0);
  return isElement(content) && content.nodeName === "page" && String(content.getAttribute("documentId")) === String(pageId);
}

// 이 페이지를 가리키는 페이지 블록을 모두 빼고 뺀 개수를 돌려줌
// 페이지 블록 아래에 들여쓴 블록이 있으면 지우지 않고 그 자리로 올림
export function removePageBlocksFromFragment(fragment: YType.XmlFragment, pageId: number): number {
  let removed = 0;
  const visit = (parent: XmlParent) => {
    for (let index = parent.length - 1; index >= 0; index -= 1) {
      const node = parent.get(index) as XmlNode;
      if (!isElement(node)) continue;
      if (isPageContainer(node, pageId)) {
        const nested = node.get(1);
        const lifted = isElement(nested) && nested.nodeName === "blockGroup"
          ? nested.toArray().filter(isElement).map((child) => child.clone())
          : [];
        parent.delete(index, 1);
        if (lifted.length > 0) {
          parent.insert(index, lifted);
          lifted.forEach((child) => visit(child));
        }
        removed += 1;
        continue;
      }
      visit(node);
    }
  };
  const run = () => visit(fragment);
  if (fragment.doc) fragment.doc.transact(run);
  else run();
  return removed;
}

// 본문 어디에든(다른 블록 안 포함) 이 페이지를 가리키는 페이지 블록이 있는지
export function fragmentHasPageBlock(fragment: YType.XmlFragment, pageId: number): boolean {
  const visit = (parent: XmlParent): boolean => parent.toArray().some((node) =>
    isElement(node as XmlNode) && (isPageContainer(node as XmlNode, pageId) || visit(node as YType.XmlElement)));
  return visit(fragment);
}

// 페이지 블록이 들어 있는 본문: 상위 페이지, 상위가 없으면 프로젝트 본문 (찾을 수 없으면 null)
export function blockHostId(
  doc: { parentId: number | null; spaceId: number },
  spaces: { id: number; homeDocumentId: number | null }[],
): number | null {
  if (doc.parentId !== null) return doc.parentId;
  return spaces.find((space) => space.id === doc.spaceId)?.homeDocumentId ?? null;
}

// 상위 본문에 잠깐 접속해 이 페이지 블록을 빼고 서버에 저장될 때까지 기다림
export async function detachPageBlock(hostId: number, pageId: number): Promise<void> {
  const { waitUntilSynced, withSyncedDocument } = await import("../collabSession");
  await withSyncedDocument(hostId, async ({ fragment, provider }) => {
    if (removePageBlocksFromFragment(fragment, pageId) > 0) await waitUntilSynced(provider);
  });
}

// 휴지통으로 보낸 페이지의 블록을 상위 본문(없으면 프로젝트 본문)에서 뺌 (실패해도 삭제는 끝난 것으로 보고 기록만)
export async function detachTrashedPage(
  doc: { id: number; parentId: number | null; spaceId: number },
  loadSpaces: () => Promise<{ id: number; homeDocumentId: number | null }[]>,
): Promise<void> {
  try {
    const hostId = blockHostId(doc, await loadSpaces());
    if (hostId !== null && hostId !== doc.id) await detachPageBlock(hostId, doc.id);
  } catch (error) {
    console.warn("지운 페이지를 상위 본문에서 빼지 못했습니다.", error);
  }
}

// 복원한 페이지가 들어갈 본문 맨 아래에 페이지 블록을 붙임 (이미 있으면 그대로)
export async function attachPageBlock(pageId: number): Promise<void> {
  const [{ getDocument }, { listSpaces }, { waitUntilSynced, withSyncedDocument }, { appendBlocksToFragment }] = await Promise.all([
    import("../../api/documents"),
    import("../../api/spaces"),
    import("../collabSession"),
    import("./blockMove"),
  ]);
  // 원래 상위가 휴지통에 있으면 서버가 다른 곳으로 옮겨 복원하므로 복원 뒤 위치로 찾음
  const [doc, spaces] = await Promise.all([getDocument(pageId), listSpaces()]);
  const hostId = blockHostId(doc, spaces);
  if (hostId === null || hostId === pageId) return;
  await withSyncedDocument(hostId, async ({ Y, fragment, provider, editor }) => {
    if (fragmentHasPageBlock(fragment, pageId)) return;
    await appendBlocksToFragment(Y, editor, fragment, [{ type: "page", props: { documentId: pageId } }] as never);
    await waitUntilSynced(provider);
  });
}
