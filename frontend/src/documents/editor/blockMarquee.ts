import type { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

type AnyEditor = BlockNoteEditor<any, any, any>;

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// 끌어서 고를 수 있는 블록 (화면 위치와 하위 블록)
export interface MarqueeBlock {
  id: string;
  rect: Rect;
  // 하위 블록 묶음의 위 끝 (하위 블록이 없으면 undefined)
  childrenTop?: number;
  children: MarqueeBlock[];
}

const intersects = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// 노션처럼 사각형에 걸린 블록 중 가장 바깥 블록을 고름
// 사각형이 한 블록(콜아웃 등)의 하위 블록 영역 안에만 있으면 그 안의 줄들을 고름
export function pickMarqueeBlocks(blocks: MarqueeBlock[], marquee: Rect): string[] {
  const hit = blocks.filter((block) => intersects(block.rect, marquee));
  if (hit.length === 1) {
    const [only] = hit;
    if (only.childrenTop !== undefined && marquee.top >= only.childrenTop && marquee.bottom <= only.rect.bottom) {
      const inner = pickMarqueeBlocks(only.children, marquee);
      if (inner.length > 0) return inner;
    }
  }
  return hit.map((block) => block.id);
}

const CHILD_BLOCKS = ":scope > .bn-block-group > .bn-block-outer > .bn-block[data-id]";

// 편집 영역의 블록 트리를 화면 위치와 함께 읽음
export function readMarqueeBlocks(container: Element): MarqueeBlock[] {
  return Array.from(container.querySelectorAll<HTMLElement>(CHILD_BLOCKS)).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.height === 0) return [];
    const group = element.querySelector(":scope > .bn-block-group");
    const groupRect = group?.getBoundingClientRect();
    return [{
      id: element.dataset.id!,
      rect,
      childrenTop: groupRect && groupRect.height > 0 ? groupRect.top : undefined,
      children: readMarqueeBlocks(element),
    }];
  });
}

// 블록 id의 문서 위치 (블록 앞·뒤)
function blockRange(doc: PMNode, id: string): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.isInGroup("bnBlock") && node.attrs.id === id) {
      found = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });
  return found;
}

// 시작하지 않는 곳: 블록 글·내용 안, 버튼·입력 칸·메뉴·손잡이·끌 수 있는 것(속성 순서 손잡이 등), 페이지 제목
const NOT_START = [
  ".bn-block-content", "button", "a", "input", "textarea", "select", "[role='menu']", "[role='dialog']",
  "[contenteditable='false']", ".bn-side-menu", ".bn-toolbar", ".bn-suggestion-menu", ".bn-table-handle",
  ".mantine-Popover-dropdown", ".mantine-Menu-dropdown", ".mantine-Input-wrapper", "[draggable='true']", ".page-title",
].join(", ");
// 고른 블록 id (편집기별): 손잡이로 끌 때 함께 옮기려고 AlignedSideMenuController가 읽음
const selections = new WeakMap<AnyEditor, string[]>();
export function marqueeSelection(editor: AnyEditor): string[] {
  return selections.get(editor) ?? [];
}

// 편집기 선택을 첫 블록 처음~마지막 블록 끝으로 잡음 (복사·여러 블록 끌기를 BlockNote 기본 처리에 맡김)
// 평소에는 잡아 두지 않음: 잡아 둔 채 글자를 치면 고른 블록 글이 지워짐
export function selectBlockRange(editor: AnyEditor, ids: string[]): void {
  const view = editor.prosemirrorView;
  const { doc } = view.state;
  const first = blockRange(doc, ids[0]);
  const last = blockRange(doc, ids[ids.length - 1]);
  if (!first || !last) return;
  view.dispatch(view.state.tr.setSelection(TextSelection.between(doc.resolve(first.from + 1), doc.resolve(last.to - 1))));
}

// 고른 블록을 클립보드로 복사 (BlockNote 복사 처리를 그대로 씀)
// 고른 뒤에는 편집기 포커스를 빼 두어 선택만 바꾸면 화면 선택이 따라오지 않고 복사도 비어 버림 → 먼저 포커스를 돌려줌
export function copyBlocks(editor: AnyEditor, ids: string[]): void {
  editor.prosemirrorView.focus();
  selectBlockRange(editor, ids);
  document.execCommand("copy");
}

// 시작점을 본문(편집기) 기준 위치로 기억해 두고 지금 본문 위치로 화면 좌표를 되살림
// 끄는 도중 휠로 스크롤해도 시작점이 처음 누른 블록에 붙어 있어 이미 고른 블록이 빠지지 않음
export interface MarqueeAnchor {
  // 누른 곳이 본문 왼쪽·위에서 떨어진 거리
  dx: number;
  dy: number;
}

export function anchorAt(root: Pick<Rect, "left" | "top">, x: number, y: number): MarqueeAnchor {
  return { dx: x - root.left, dy: y - root.top };
}

export function marqueeRect(anchor: MarqueeAnchor, root: Pick<Rect, "left" | "top">, x: number, y: number): Rect {
  const startX = root.left + anchor.dx;
  const startY = root.top + anchor.dy;
  return { left: Math.min(startX, x), top: Math.min(startY, y), right: Math.max(startX, x), bottom: Math.max(startY, y) };
}

const SELECTED_ATTR = "data-marquee-selected";
const ACTIVE_CLASS = "block-marquee-active";
// 사각형을 그리는 동안 html에 붙임 (블록 손잡이 숨김)
const DRAGGING_CLASS = "block-marquee-dragging";
const DRAG_THRESHOLD = 4;

// 노션처럼 블록 바깥(손잡이 왼쪽 여백 등)에서 끌면 사각형으로 여러 블록을 고름
// 고른 블록은 파랗게 표시하고 Delete·Backspace로 지움, Ctrl+C·X로 복사·잘라내기, 손잡이로 함께 끌어 옮김
// 고르는 동안은 편집기 포커스를 빼서 글자를 쳐도 아무 일 없음 (노션과 같음)
export function installBlockMarquee(editor: AnyEditor, area: HTMLElement, signal: AbortSignal): void {
  let start: MarqueeAnchor | undefined;
  // 마지막 마우스 위치 (휠 스크롤 때 이 위치로 사각형을 다시 계산)
  let pointer: { x: number; y: number } = { x: 0, y: 0 };
  let box: HTMLDivElement | undefined;
  let selected: string[] = [];
  const editorRoot = () => area.querySelector<HTMLElement>(".bn-editor");

  const mark = (ids: string[]) => {
    const root = editorRoot();
    root?.querySelectorAll(`[${SELECTED_ATTR}]`).forEach((el) => el.removeAttribute(SELECTED_ATTR));
    for (const id of ids) root?.querySelector(`.bn-block[data-id="${CSS.escape(id)}"]`)?.setAttribute(SELECTED_ATTR, "");
    root?.classList.toggle(ACTIVE_CLASS, ids.length > 0);
  };

  const setSelected = (ids: string[]) => {
    selected = ids;
    selections.set(editor, ids);
  };

  const clear = () => {
    if (selected.length === 0) return;
    setSelected([]);
    mark([]);
  };

  const finishBox = () => {
    box?.remove();
    box = undefined;
    start = undefined;
    document.documentElement.style.removeProperty("user-select");
    document.documentElement.classList.remove(DRAGGING_CLASS);
  };

  area.addEventListener("mousedown", (e) => {
    clear();
    const root = editorRoot();
    const target = e.target instanceof Element ? e.target : null;
    if (e.button !== 0 || !editor.isEditable || !root || !target || target.closest(NOT_START)) return;
    // 노션처럼 페이지 영역 어디서든 시작 (첫 블록 위 빈 곳·속성 줄 여백·본문 아래 등)
    start = anchorAt(root.getBoundingClientRect(), e.clientX, e.clientY);
    pointer = { x: e.clientX, y: e.clientY };
    // 편집기 빈 여백을 누른 경우 글자 선택이 시작되지 않게 함
    if (root.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true, signal });

  // 지금 마우스 위치까지 사각형을 그리고 걸린 블록을 고름 (본문이 스크롤돼도 시작점은 처음 누른 자리)
  const update = () => {
    const root = editorRoot();
    if (!start || !box || !root) return;
    const rect = marqueeRect(start, root.getBoundingClientRect(), pointer.x, pointer.y);
    Object.assign(box.style, {
      left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px`,
    });
    setSelected(pickMarqueeBlocks(readMarqueeBlocks(root), rect));
    mark(selected);
  };

  document.addEventListener("mousemove", (e) => {
    if (!start) return;
    pointer = { x: e.clientX, y: e.clientY };
    if (!box) {
      const root = editorRoot();
      if (!root) return;
      const origin = marqueeRect(start, root.getBoundingClientRect(), e.clientX, e.clientY);
      if (Math.hypot(origin.right - origin.left, origin.bottom - origin.top) < DRAG_THRESHOLD) return;
      box = document.createElement("div");
      box.className = "block-marquee";
      document.body.appendChild(box);
      document.documentElement.style.setProperty("user-select", "none");
      document.documentElement.classList.add(DRAGGING_CLASS);
    }
    e.preventDefault();
    update();
  }, { signal });

  // 끄는 도중 휠로 스크롤하면 마우스가 그대로여도 사각형·선택을 다시 계산 (스크롤하는 요소가 무엇이든 받도록 capture)
  window.addEventListener("scroll", () => {
    if (start && box) update();
  }, { capture: true, passive: true, signal });

  document.addEventListener("mouseup", () => {
    if (!start) return;
    const dragged = !!box;
    finishBox();
    // 고른 동안 글자 입력이 블록에 들어가지 않게 편집기 포커스를 뺌
    if (dragged && selected.length > 0) {
      editor.prosemirrorView.dom.blur();
      document.getSelection()?.removeAllRanges();
    }
  }, { signal });

  window.addEventListener("keydown", (e) => {
    if (selected.length === 0 || e.isComposing) return;
    const ids = selected;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      clear();
      editor.removeBlocks(ids.filter((id) => editor.getBlock(id)));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
      e.preventDefault();
      e.stopPropagation();
      // 블록 범위를 잠깐 선택해 복사한 뒤 블록을 지움
      copyBlocks(editor, ids);
      clear();
      editor.removeBlocks(ids.filter((id) => editor.getBlock(id)));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      copyBlocks(editor, ids);
      editor.prosemirrorView.dom.blur();
      document.getSelection()?.removeAllRanges();
      return;
    }
    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    // Esc는 선택 해제, 그 밖의 키는 무시 (편집기 포커스가 없어 글자가 들어가지 않음)
    if (e.key === "Escape") {
      e.preventDefault();
      clear();
    }
  }, { capture: true, signal });

  // 블록을 옮기거나 다른 사람이 고치면 표시가 어긋나므로 해제
  const offChange = editor.onChange(() => clear());
  signal.addEventListener("abort", () => {
    offChange?.();
    finishBox();
    mark([]);
  });
}
