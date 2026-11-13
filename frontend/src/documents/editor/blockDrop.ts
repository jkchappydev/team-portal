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
}

export type DropPlacement = "before" | "after" | "firstChild";
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

const BLOCK_SELECTOR = ".bn-block[data-id]";

function ownContent(block: Element): Element | null {
  return block.querySelector(":scope > .bn-block-content, :scope > .react-renderer > .bn-block-content");
}

// 편집 영역에서 보이는 블록 줄을 모음 (끄는 블록과 그 하위는 제외)
export function collectDropRows(root: Element, excludedIds: ReadonlySet<string>): DropRow[] {
  const rows: DropRow[] = [];
  for (const block of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const id = block.dataset.id!;
    if (excludedIds.has(id) || [...excludedIds].some((ex) => block.parentElement?.closest(`${BLOCK_SELECTOR}[data-id="${CSS.escape(ex)}"]`))) {
      continue;
    }
    const own = ownContent(block);
    const blockRect = block.getBoundingClientRect();
    if (!own || blockRect.height === 0) continue;
    const ownRect = own.getBoundingClientRect();
    const group = block.querySelector(":scope > .bn-block-group");
    const parent = block.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR);
    const container = own.getAttribute("data-content-type") === "callout";
    rows.push({
      id,
      parentId: parent && root.contains(parent) ? parent.dataset.id! : null,
      top: container ? blockRect.top : ownRect.top,
      bottom: container ? blockRect.bottom : ownRect.bottom,
      blockBottom: blockRect.bottom,
      hasChildren: !!group && group.getBoundingClientRect().height > 0,
      container,
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
      found = { before: pos, after: pos + node.nodeSize, firstChild: pos + 1 + (content?.nodeSize ?? 0) + 1 };
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
function dropTargetAt(view: EditorView, ids: string[], y: number): DropTarget | null {
  if (isOverDragged(view.dom, ids, y)) return null;
  return pickDropTarget(collectDropRows(view.dom, new Set(ids)), y);
}

// 놓기선 위치: 실제 놓는 자리(drop 처리)와 같은 계산을 씀
export const notionDropCursor: DropCursorOptions["hooks"] = {
  computeDropPosition: ({ editor, event, view, defaultPosition }) => {
    const ids = internalDrag(editor, view, event);
    if (!ids) return defaultPosition;
    const target = dropTargetAt(view, ids, event.clientY);
    const positions = target && blockPositions(view.state.doc, target.blockId);
    return positions ? { pos: positions[target.placement], orientation: "block-horizontal" } : null;
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
    if (target.placement !== "firstChild") {
      editor.insertBlocks(blocks, reference, target.placement);
    } else if (reference.children.length > 0) {
      editor.insertBlocks(blocks, reference.children[0], "before");
    } else {
      editor.updateBlock(reference, { children: blocks });
    }
  });
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
            const target = dropTargetAt(view, ids, event.clientY);
            if (target) moveBlocks(editor, ids, target);
            releaseAfterDrop(view);
            return true;
          },
        },
      },
    }),
  ],
}));
