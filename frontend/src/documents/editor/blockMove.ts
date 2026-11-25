import type { BlockNoteEditor } from "@blocknote/core";
import type * as YType from "yjs";
import { pageIdsIn } from "./pagePaste";

// 블록을 다른 페이지 본문으로 옮기기 (노션의 "옮기기", 페이지 블록 위에 끌어 놓기)
// 순서: 옮기는 블록 안의 페이지를 대상 페이지 아래로 옮김 → 대상 본문 맨 아래에 블록을 덧붙임 → 지금 본문에서 블록을 지움
// 중간에 실패하면 이미 옮긴 페이지를 원래 페이지 아래로 되돌리고 본문은 그대로 둠

// 블록 메뉴 "옮기기"가 편집기에 페이지 고르는 창을 열어 달라고 알리는 이벤트 (detail: 블록 id 목록)
export const OPEN_MOVE_PICKER_EVENT = "page-portal:open-move-picker";
// 블록을 페이지 블록 위에 끌어 놓았을 때 그 페이지로 옮겨 달라고 알리는 이벤트
export const MOVE_INTO_PAGE_EVENT = "page-portal:move-into-page";

export interface MoveIntoPageDetail {
  blockIds: string[];
  targetDocumentId: number;
}

interface BlockLike {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: BlockLike[];
}

export interface MoveToPageActions {
  // 페이지를 targetDocumentId 아래로 옮김
  movePage: (pageId: number, targetDocumentId: number) => Promise<void>;
  // 대상 본문 맨 아래에 블록을 덧붙임
  appendBlocks: (targetDocumentId: number, blocks: BlockLike[]) => Promise<void>;
  // 지금 본문에서 옮긴 블록을 지움
  removeBlocks: () => void;
}

// 옮겨 간 페이지 (지금 본문에서 블록이 지워져도 휴지통으로 보내지 않도록 잠시 기억)
const MOVED_TTL_MS = 60_000;
const movedPages = new Map<number, number>();

export function markPagesMoved(pageIds: number[], now = Date.now()): void {
  pageIds.forEach((id) => movedPages.set(id, now));
}

export function isPageMoved(pageId: number, now = Date.now()): boolean {
  const at = movedPages.get(pageId);
  if (at === undefined) return false;
  if (now - at > MOVED_TTL_MS) {
    movedPages.delete(pageId);
    return false;
  }
  return true;
}

export async function moveBlocksToPage(
  { blocks, sourceDocumentId, targetDocumentId }: { blocks: BlockLike[]; sourceDocumentId: number; targetDocumentId: number },
  actions: MoveToPageActions,
): Promise<void> {
  if (blocks.length === 0) return;
  if (targetDocumentId === sourceDocumentId) throw new Error("지금 보고 있는 페이지입니다.");
  const pageIds = pageIdsIn(blocks);
  if (pageIds.includes(targetDocumentId)) throw new Error("옮기는 블록 안의 페이지로는 옮길 수 없습니다.");
  const moved: number[] = [];
  try {
    for (const pageId of pageIds) {
      await actions.movePage(pageId, targetDocumentId);
      moved.push(pageId);
    }
    await actions.appendBlocks(targetDocumentId, blocks);
  } catch (error) {
    // 본문은 그대로 두므로 페이지도 원래 페이지 아래로 되돌림
    for (const pageId of moved.reverse()) {
      await actions.movePage(pageId, sourceDocumentId).catch(() => undefined);
    }
    throw error;
  }
  markPagesMoved(pageIds);
  actions.removeBlocks();
}

interface EmptyCheckBlock {
  type: string;
  content?: unknown;
  children?: unknown[];
}

function isOnlyEmptyLine(blocks: EmptyCheckBlock[]): boolean {
  if (blocks.length !== 1) return false;
  const [block] = blocks;
  const content = block.content;
  return block.type === "paragraph" && (!Array.isArray(content) || content.length === 0) && !block.children?.length;
}

// 협업 본문(Y 조각) 맨 아래에 블록을 덧붙임 (다른 사람이 편집 중인 기존 내용은 건드리지 않음)
// 본문이 빈 줄 하나뿐이면 그 줄을 바꿈
export async function appendBlocksToFragment(
  Y: typeof YType,
  editor: BlockNoteEditor<any, any, any>,
  fragment: YType.XmlFragment,
  blocks: BlockLike[],
): Promise<void> {
  const { blocksToYXmlFragment, yXmlFragmentToBlocks } = await import("@blocknote/core/yjs");
  const group = fragment.length > 0 ? fragment.get(0) : null;
  if (!(group instanceof Y.XmlElement) || group.nodeName !== "blockGroup") {
    blocksToYXmlFragment(editor, blocks as never, fragment);
    return;
  }
  // 다른 Y 문서에서 블록을 만든 뒤 복제해 넣음 (Y 노드는 문서 사이로 옮길 수 없음)
  const scratch = new Y.Doc();
  try {
    const converted = scratch.getXmlFragment("blocks");
    blocksToYXmlFragment(editor, blocks as never, converted);
    const convertedGroup = converted.get(0);
    if (!(convertedGroup instanceof Y.XmlElement)) return;
    const containers = convertedGroup.toArray().map((node) => (node as YType.XmlElement).clone());
    const onlyEmpty = isOnlyEmptyLine(yXmlFragmentToBlocks(editor, fragment) as EmptyCheckBlock[]);
    fragment.doc!.transact(() => {
      if (onlyEmpty) group.delete(0, group.length);
      group.insert(group.length, containers);
    });
  } finally {
    scratch.destroy();
  }
}

// 다른 페이지 본문에 잠깐 접속해 맨 아래에 블록을 덧붙이고, 서버에 저장될 때까지 기다림
export async function appendBlocksToDocument(documentId: number, blocks: BlockLike[]): Promise<void> {
  const { waitUntilSynced, withSyncedDocument } = await import("../collabSession");
  await withSyncedDocument(documentId, async ({ Y, fragment, provider, editor }) => {
    await appendBlocksToFragment(Y, editor, fragment, blocks);
    await waitUntilSynced(provider);
  });
}
