// 본문 페이지 블록을 복사·잘라내 붙여넣을 때 페이지를 어떻게 할지 (노션처럼)
// 잘라내기(Ctrl+X) 후 붙여넣기: 페이지를 붙여넣은 페이지 아래로 옮김 (브레드크럼도 새 위치)
// 복사(Ctrl+C) 후 붙여넣기: 붙여넣은 페이지 아래에 페이지 사본(원래 제목, "(사본)"은 블록 메뉴 복제에만)을 만들고 블록이 사본을 가리킴
// 예전에는 둘 다 같은 페이지를 가리키는 바로가기만 생겨, 원본 블록을 지우면 페이지가 예전 위치에 그대로 남았음

interface BlockLike {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: BlockLike[];
}

// 잘라낸 페이지 기록 (같은 브라우저의 다른 탭에 붙여넣어도 알도록 브라우저 저장소, 오래된 기록은 무시)
const CUT_KEY = "page-block-cut";
const CUT_TTL_MS = 30 * 60_000;
// 영역 선택 잘라내기는 복사 후 블록을 지우는 방식이라, 복사 이벤트 뒤에 이 이벤트로 잘라내기임을 알림 (editor/blockMarquee)
export const BLOCKS_CUT_EVENT = "page-portal:blocks-cut";

interface CutRecord {
  sourceDocumentId: number;
  pageIds: number[];
  at: number;
}

// 블록과 하위 블록 안의 페이지 블록이 가리키는 문서 ID
export function pageIdsIn(blocks: BlockLike[]): number[] {
  const ids: number[] = [];
  const walk = (list: BlockLike[]) => {
    for (const block of list) {
      const documentId = block.props?.documentId;
      if (block.type === "page" && typeof documentId === "number" && documentId > 0) ids.push(documentId);
      walk(block.children ?? []);
    }
  };
  walk(blocks);
  return ids;
}

function readCut(): CutRecord | null {
  try {
    const raw = localStorage.getItem(CUT_KEY);
    const record = raw ? (JSON.parse(raw) as CutRecord) : null;
    return record && Date.now() - record.at < CUT_TTL_MS ? record : null;
  } catch {
    return null;
  }
}

function writeCut(record: CutRecord | null): void {
  try {
    if (record) localStorage.setItem(CUT_KEY, JSON.stringify(record));
    else localStorage.removeItem(CUT_KEY);
  } catch {
    // 저장소를 못 쓰면 잘라내기도 복사처럼 사본을 만듦
  }
}

export function recordPageCut(sourceDocumentId: number, pageIds: number[]): void {
  writeCut(pageIds.length > 0 ? { sourceDocumentId, pageIds, at: Date.now() } : null);
}

export function clearPageCut(): void {
  writeCut(null);
}

// 잘라내 붙여넣기를 기다리는 페이지인지 (본문에서 블록이 지워져도 휴지통으로 보내지 않음)
export function isPageCut(pageId: number): boolean {
  return readCut()?.pageIds.includes(pageId) ?? false;
}

// 잘라낸 페이지면 잘라낸 페이지(원래 본문) ID를 돌려주고 기록에서 뺌 (같은 내용을 다시 붙여넣으면 그때는 사본)
export function takePageCut(pageId: number): number | null {
  const record = readCut();
  if (!record || !record.pageIds.includes(pageId)) return null;
  const rest = record.pageIds.filter((id) => id !== pageId);
  writeCut(rest.length > 0 ? { ...record, pageIds: rest } : null);
  return record.sourceDocumentId;
}

export interface PastedPageActions {
  // 페이지를 targetDocumentId 아래로 옮김
  movePage: (pageId: number, targetDocumentId: number) => Promise<void>;
  // targetDocumentId 아래에 사본을 만들고 새 문서 ID를 돌려줌
  copyPage: (pageId: number, targetDocumentId: number) => Promise<number>;
  // 붙여넣은 블록이 가리킬 문서를 바꿈 (사본으로)
  pointBlockTo: (blockId: string, documentId: number) => void;
  onError: (message: string) => void;
}

// 붙여넣어 들어온 블록 안의 페이지 블록 처리 (잘라낸 것은 옮기고, 복사한 것은 사본)
export async function adoptPastedPages(blocks: BlockLike[], documentId: number, actions: PastedPageActions): Promise<void> {
  const pageBlocks: BlockLike[] = [];
  // 변경 목록에 부모 블록과 그 하위 블록이 따로 들어올 수 있어 같은 블록은 한 번만 (사본이 두 개 생기지 않게)
  const seen = new Set<string>();
  const walk = (list: BlockLike[]) => {
    for (const block of list) {
      if (seen.has(block.id)) continue;
      seen.add(block.id);
      if (block.type === "page" && typeof block.props?.documentId === "number" && block.props.documentId > 0) pageBlocks.push(block);
      walk(block.children ?? []);
    }
  };
  walk(blocks);
  for (const block of pageBlocks) {
    const pageId = block.props!.documentId as number;
    // 자기 자신을 가리키는 블록은 건드리지 않음
    if (pageId === documentId) continue;
    try {
      const cutFrom = takePageCut(pageId);
      if (cutFrom !== null) {
        // 같은 본문 안에서 잘라 붙여넣은 것은 위치만 바뀐 것이라 그대로
        if (cutFrom !== documentId) await actions.movePage(pageId, documentId);
      } else {
        actions.pointBlockTo(block.id, await actions.copyPage(pageId, documentId));
      }
    } catch (error) {
      actions.onError(error instanceof Error && error.message ? error.message : "붙여넣은 페이지를 처리하지 못했습니다.");
    }
  }
}
