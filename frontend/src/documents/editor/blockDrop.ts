import { createExtension } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import type { DropCursorOptions } from "@blocknote/core/extensions";
import type { Fragment, Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// 화면에 보이는 블록 한 줄 (문서 순서대로)
export interface DropRow {
  id: string;
  parentId: string | null;
  // 블록 자기 내용(글줄)의 위·아래, 하위 블록 제외
  top: number;
  bottom: number;
  // 하위 블록까지 포함한 블록 전체 아래
  blockBottom: number;
  // 펼쳐진 하위 블록이 있는지
  hasChildren: boolean;
  // 콜아웃처럼 하위 블록을 상자 안에 담는 블록 (자기 줄 대신 상자 전체 기준)
  container: boolean;
  // 펼쳐져 있지만 비어 있는 토글 (제목 아래쪽 절반과 "비어 있는 토글" 안내 줄에 놓으면 하위로 넣음)
  emptyToggle?: boolean;
  // 가로 범위: 열 안의 줄은 그 열의 좌우, 그 밖은 블록 줄의 좌우 (없으면 가로 위치를 따지지 않음)
  left?: number;
  right?: number;
  // 이 줄을 담은 열(column) id, 열 밖이면 null
  columnId?: string | null;
  // 옆에 놓아 열을 만들 수 있는 줄 (최상위 블록 또는 열 바로 안의 블록)
  sideAllowed?: boolean;
}

export type DropPlacement = "before" | "after" | "firstChild" | "left" | "right";
export interface DropTarget {
  blockId: string;
  placement: DropPlacement;
}

// 노션처럼 마우스 높이만으로 놓일 자리를 정함
// 블록 줄의 위쪽 절반이면 그 블록 앞, 아래쪽 절반이면 뒤 (하위 블록이 펼쳐져 있으면 첫 하위 블록 앞)
// 끄는 블록과 그 하위 블록은 rows에서 빼고 넘김 (자기 안으로는 놓을 수 없음)
export function pickDropTarget(rows: DropRow[], y: number): DropTarget | null {
  if (rows.length === 0) return null;
  if (y < rows[0].top) return { blockId: rows[0].id, placement: "before" };
  let index = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].top <= y) index = i;
  }
  const row = rows[index];
  if (row.container) {
    // 콜아웃 위 여백: 상자 위쪽 절반이면 앞, 아래면 뒤 (하위 줄이 있으면 그 줄들이 먼저 잡힘)
    return { blockId: row.id, placement: y < (row.top + row.blockBottom) / 2 ? "before" : "after" };
  }
  if (y < (row.top + row.bottom) / 2) return { blockId: row.id, placement: "before" };
  if (row.hasChildren) return { blockId: row.id, placement: "firstChild" };
  if (row.emptyToggle && y <= row.blockBottom) return { blockId: row.id, placement: "firstChild" };
  // 부모 상자(콜아웃 등) 아래 바깥이면 부모 뒤로 올라감
  const byId = new Map(rows.map((r) => [r.id, r]));
  let target = row;
  let parent = target.parentId ? byId.get(target.parentId) : undefined;
  while (parent && y > parent.blockBottom) {
    target = parent;
    parent = target.parentId ? byId.get(target.parentId) : undefined;
  }
  return { blockId: target.id, placement: "after" };
}

// 블록 줄 오른쪽 가장자리 중 옆에 놓기로 보는 폭 (줄 너비의 20%, 최대 120px)
const SIDE_ZONE_RATIO = 0.2;
const SIDE_ZONE_MAX = 120;
// 왼쪽 옆 놓기 폭: 손잡이가 줄 왼쪽 바깥에 있어 끌다 보면 마우스가 줄 앞쪽으로 들어오기 쉬움
// 위·아래 놓기를 우선하도록 줄 맨 앞 좁은 띠만 옆 놓기로 봄
const LEFT_SIDE_ZONE_MAX = 24;
// 열 사이 간격의 절반: 열 경계 근처도 그 열로 봄
const COLUMN_GAP_HALF = 12;

// 노션처럼 마우스 가로·세로 위치로 놓을 자리를 정함
// 열 안의 줄은 마우스가 있는 열의 줄만 대상으로 하고, 블록 줄 안쪽 좌우 가장자리면 그 블록 옆(새 열)에 놓음
// 손잡이로 끌 때 마우스는 블록 글 왼쪽 바깥에 있으므로 줄 바깥 왼쪽은 옆 놓기로 보지 않음
export function pickDropTargetAt(rows: DropRow[], x: number, y: number, allowSide = true): DropTarget | null {
  const visible = rows.filter((row) => !row.columnId || row.left === undefined || row.right === undefined
    || (x >= row.left - COLUMN_GAP_HALF && x <= row.right + COLUMN_GAP_HALF));
  const target = pickDropTarget(visible, y);
  if (!target || !allowSide) return target;
  const row = visible.find((r) => r.id === target.blockId);
  if (!row?.sideAllowed || row.left === undefined || row.right === undefined) return target;
  // 블록 자기 줄 높이 안에서만 (콜아웃은 상자 전체)
  if (y < row.top || y > (row.container ? row.blockBottom : row.bottom)) return target;
  const zone = Math.min(SIDE_ZONE_MAX, (row.right - row.left) * SIDE_ZONE_RATIO);
  if (x >= row.left && x <= row.left + Math.min(zone, LEFT_SIDE_ZONE_MAX)) return { blockId: row.id, placement: "left" };
  if (x >= row.right - zone && x <= row.right + COLUMN_GAP_HALF) return { blockId: row.id, placement: "right" };
  return target;
}

const BLOCK_SELECTOR = ".bn-block[data-id]";
const COLUMN_SELECTOR = ".bn-column[data-id]";

// 블록 바로 안의 요소 (토글은 내용과 하위 블록이 .bn-toggle-frame > .bn-toggle-slot 안에 한 겹 더 들어 있음)
const OWN_PATHS = [":scope > ", ":scope > .react-renderer > ", ":scope > .bn-toggle-frame > .bn-toggle-slot > "];
function ownChild(block: Element, selector: string): Element | null {
  return block.querySelector(OWN_PATHS.map((path) => path + selector).join(", "));
}

// 편집 영역에서 보이는 블록 줄을 모음 (끄는 블록과 그 하위는 제외)
export function collectDropRows(root: Element, excludedIds: ReadonlySet<string>): DropRow[] {
  const rows: DropRow[] = [];
  for (const block of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const id = block.dataset.id!;
    if (excludedIds.has(id) || [...excludedIds].some((ex) => block.parentElement?.closest(`${BLOCK_SELECTOR}[data-id="${CSS.escape(ex)}"]`))) {
      continue;
    }
    const own = ownChild(block, ".bn-block-content");
    const blockRect = block.getBoundingClientRect();
    if (!own || blockRect.height === 0) continue;
    const ownRect = own.getBoundingClientRect();
    const group = ownChild(block, ".bn-block-group");
    const parent = block.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR);
    const container = own.getAttribute("data-content-type") === "callout";
    // 이 블록을 바로 담은 열 (부모 블록보다 가까운 열만)
    const column = block.parentElement?.closest<HTMLElement>(COLUMN_SELECTOR);
    const inColumn = !!column && (!parent || parent.contains(column));
    const span = inColumn ? column!.getBoundingClientRect() : blockRect;
    rows.push({
      id,
      parentId: parent && root.contains(parent) ? parent.dataset.id! : null,
      top: container ? blockRect.top : ownRect.top,
      bottom: container ? blockRect.bottom : ownRect.bottom,
      blockBottom: blockRect.bottom,
      hasChildren: !!group && group.getBoundingClientRect().height > 0,
      container,
      // BlockNote는 펼쳐진 빈 토글에만 "비어 있는 토글" 안내 버튼을 붙임
      emptyToggle: !!block.querySelector(":scope > .bn-toggle-frame > .bn-toggle-add-block-button"),
      left: span.left,
      right: span.right,
      columnId: inColumn ? column!.dataset.id! : null,
      sideAllowed: inColumn || !parent || !root.contains(parent),
    });
  }
  return rows;
}

// 끄는 내용에 담긴 최상위 블록 id
export function draggedBlockIds(fragment: Fragment): string[] {
  const ids: string[] = [];
  fragment.forEach((node: PMNode) => {
    if (node.type.isInGroup("bnBlock") && typeof node.attrs.id === "string") ids.push(node.attrs.id);
    else ids.push(...draggedBlockIds(node.content));
  });
  return ids;
}

// 문서 안 블록 위치 (블록 앞·뒤, 첫 하위 블록 앞)
function blockPositions(doc: PMNode, id: string): Record<DropPlacement, number> | null {
  let found: Record<DropPlacement, number> | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.isInGroup("bnBlock") && node.attrs.id === id) {
      const content = node.firstChild;
      // 첫 하위 블록 앞: 하위 묶음이 있으면 그 안 맨 앞, 없으면 블록 내용 바로 뒤 (BlockNote 하위 넣기 표시와 같은 자리)
      const contentEnd = pos + 1 + (content?.nodeSize ?? 0);
      const firstChild = node.childCount > 1 ? contentEnd + 1 : contentEnd;
      found = { before: pos, after: pos + node.nodeSize, firstChild, left: pos, right: pos };
      return false;
    }
    return true;
  });
  return found;
}

// 이 편집기 안에서 블록 손잡이로 끄는 중일 때만 노션식 위치를 씀 (파일·외부 글 끌어오기는 기본 처리)
function internalDrag(editor: BlockNoteEditor<any, any, any>, view: EditorView, event: DragEvent): string[] | null {
  if (!view.dragging?.slice || !event.dataTransfer?.types.includes("blocknote/html")) return null;
  const ids = draggedBlockIds(view.dragging.slice.content);
  return ids.length > 0 && ids.every((id) => editor.getBlock(id)) ? ids : null;
}

// 끄는 블록 자기 영역 위인지 (콜아웃 제목 손잡이로 콜아웃을 끌 때 자기 본문 위 등)
export function isOverDragged(root: Element, ids: string[], y: number): boolean {
  return ids.some((id) => {
    const rect = root.querySelector(`${BLOCK_SELECTOR}[data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect();
    return !!rect && rect.height > 0 && y >= rect.top && y <= rect.bottom;
  });
}

// 끄는 블록 자기 영역 위에서는 놓을 자리 없음 (선도 안 그리고 놓아도 그대로): 콜아웃 제목은 자기 본문으로 들어갈 수 없음
function dropTargetAt(editor: BlockNoteEditor<any, any, any>, view: EditorView, ids: string[], x: number, y: number): DropTarget | null {
  if (isOverDragged(view.dom, ids, y)) return null;
  // 열 묶음은 열 안에 넣을 수 없어 옆 놓기를 하지 않음
  const allowSide = ids.every((id) => editor.getBlock(id)?.type !== "columnList");
  return pickDropTargetAt(collectDropRows(view.dom, new Set(ids)), x, y, allowSide);
}

// 놓기선 위치: 실제 놓는 자리(drop 처리)와 같은 계산을 씀
export const notionDropCursor: DropCursorOptions["hooks"] = {
  computeDropPosition: ({ editor, event, view, defaultPosition }) => {
    const ids = internalDrag(editor, view, event);
    if (!ids) return defaultPosition;
    const target = dropTargetAt(editor, view, ids, event.clientX, event.clientY);
    const positions = target && blockPositions(view.state.doc, target.blockId);
    if (!positions) return null;
    // 옆에 놓을 때는 블록 왼쪽·오른쪽 세로선, 그 밖은 가로선
    const orientation = target.placement === "left" ? "block-vertical-left" : target.placement === "right" ? "block-vertical-right" : "block-horizontal";
    return { pos: positions[target.placement], orientation };
  },
};

// 블록을 놓은 자리로 옮김 (끄는 블록을 지우고 같은 id 그대로 다시 넣음)
export function moveBlocks(editor: BlockNoteEditor<any, any, any>, ids: string[], target: DropTarget): void {
  const blocks = ids.map((id) => editor.getBlock(id)).filter((b) => b !== undefined);
  if (blocks.length === 0) return;
  editor.transact(() => {
    editor.removeBlocks(blocks);
    const reference = editor.getBlock(target.blockId);
    if (!reference) return;
    if (target.placement === "left" || target.placement === "right") {
      placeBeside(editor, blocks, reference, target.placement);
    } else if (target.placement !== "firstChild") {
      editor.insertBlocks(blocks, reference, target.placement);
    } else if (reference.children.length > 0) {
      editor.insertBlocks(blocks, reference.children[0], "before");
    } else {
      editor.updateBlock(reference, { children: blocks });
    }
  });
}

// 노션처럼 블록 옆에 놓으면 열로 나눔
// 열 안의 블록 옆이면 그 열 옆에 새 열을 더하고(너비는 기존 열 평균), 그 밖이면 두 블록을 열 묶음으로 감쌈
function placeBeside(editor: BlockNoteEditor<any, any, any>, blocks: any[], reference: any, side: "left" | "right"): void {
  const parent = editor.getParentBlock(reference);
  if (parent?.type === "column") {
    const list = editor.getParentBlock(parent);
    const widths = (list?.children ?? [parent]).map((column: any) => Number(column.props.width) || 1);
    const width = widths.reduce((sum: number, w: number) => sum + w, 0) / widths.length;
    editor.insertBlocks([{ type: "column", props: { width }, children: blocks }], parent, side === "left" ? "before" : "after");
    return;
  }
  const dragged = { type: "column", props: { width: 1 }, children: blocks };
  const existing = { type: "column", props: { width: 1 }, children: [reference] };
  editor.replaceBlocks([reference], [{ type: "columnList", children: side === "left" ? [dragged, existing] : [existing, dragged] }]);
}

// 끌어 놓은 뒤 노션처럼 옮긴 블록 선택 표시와 커서를 해제
// BlockNote는 끌기 끝(dragend)에 편집기에 다시 포커스를 주므로 그 뒤에 처리
export function releaseAfterDrop(view: EditorView): void {
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    const { state } = view;
    // 블록 전체 선택(파란 표시)을 글 커서로 바꾼 뒤 포커스를 뺌
    view.dispatch(state.tr.setSelection(Selection.near(state.selection.$from)));
    view.dom.blur();
    view.dom.ownerDocument.getSelection()?.removeAllRanges();
  };
  window.addEventListener("dragend", () => setTimeout(release, 0), { once: true });
  // dragend가 오지 않는 경우(합성 끌기 등) 대비
  setTimeout(release, 300);
}

// 블록 손잡이로 끌어 놓을 때 놓기선이 보인 자리 그대로 옮김
// 기본 처리는 선 표시와 다른 방식(글자 위치 기준)으로 놓을 자리를 다시 계산해 선과 다른 곳에 들어가는 경우가 있음
export const blockDropExtension = createExtension(({ editor }) => ({
  key: "notionBlockDrop",
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("notionBlockDrop"),
      props: {
        handleDOMEvents: {
          drop: (view, event) => {
            const ids = internalDrag(editor, view, event);
            if (!ids) return false;
            event.preventDefault();
            const target = dropTargetAt(editor, view, ids, event.clientX, event.clientY);
            if (target) moveBlocks(editor, ids, target);
            releaseAfterDrop(view);
            return true;
          },
        },
      },
    }),
  ],
}));
