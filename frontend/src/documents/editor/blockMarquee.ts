import { createExtension } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
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

// 하위 블록 묶음 위치: 보통 블록은 바로 아래, 토글은 내용과 함께 .bn-toggle-frame > .bn-toggle-slot 안에 한 겹 더 들어 있음
const GROUP_PATHS = [":scope > .bn-block-group", ":scope > .bn-toggle-frame > .bn-toggle-slot > .bn-block-group"];
// 묶음 안의 블록: 보통 블록은 .bn-block-outer로 감싸고, 열 묶음(.bn-column-list)은 감싸지 않고 바로 놓임
const CHILD_BLOCKS = GROUP_PATHS
  .flatMap((group) => [`${group} > .bn-block-outer > .bn-block[data-id]`, `${group} > .bn-column-list[data-id]`])
  .join(", ");
// 열 묶음 안의 블록 (열마다 위에서 아래로)
const COLUMN_BLOCKS = ":scope > .bn-column > .bn-column-slot > .bn-block-outer > .bn-block[data-id]";

// 편집 영역의 블록 트리를 화면 위치와 함께 읽음 (열 묶음과 토글 안 블록 포함)
export function readMarqueeBlocks(container: Element): MarqueeBlock[] {
  const columnList = container.classList.contains("bn-column-list");
  const elements = container.querySelectorAll<HTMLElement>(columnList ? COLUMN_BLOCKS : CHILD_BLOCKS);
  return Array.from(elements).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.height === 0) return [];
    // 열 묶음은 자기 글줄이 없어 전체가 하위 블록 영역
    const group = element.classList.contains("bn-column-list") ? element : element.querySelector(GROUP_PATHS.join(", "));
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

// 고른 블록에 대한 단축키 (한글 입력 상태에서는 Ctrl+C의 key가 "ㅊ"이나 "Process"로 와서 key만 보면 복사가 되다 말다 함 → 자판 위치 code로 판단)
export type MarqueeKeyAction = "delete" | "cut" | "copy" | "escape" | null;
export function marqueeKeyAction(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey">): MarqueeKeyAction {
  if (e.key === "Delete" || e.key === "Backspace" || e.code === "Delete" || e.code === "Backspace") return "delete";
  if (e.key === "Escape" || e.code === "Escape") return "escape";
  if (!e.ctrlKey && !e.metaKey) return null;
  if (e.code === "KeyX" || e.key.toLowerCase() === "x") return "cut";
  if (e.code === "KeyC" || e.key.toLowerCase() === "c") return "copy";
  return null;
}

// 복사하느라 잡은 블록 범위 선택을 첫 위치로 접음
// 남겨 두면 나중에 그 범위 안 블록 손잡이를 끌 때 BlockNote가 고르지 않은 블록까지 함께 옮김
function collapseSelection(editor: AnyEditor): void {
  const view = editor.prosemirrorView;
  view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.selection.$from)));
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
const MARQUEE_KEY = new PluginKey<string[]>("blockMarquee");

// 고른 블록 표시: 블록 노드(.bn-block-outer, 열 묶음은 .bn-column-list)에 속성을, 편집기 루트에 클래스를 붙임
// 편집기가 관리하는 표시라 블록을 다시 그려도 사라지지 않음
export const blockMarqueeExtension = createExtension(() => ({
  key: "blockMarquee",
  prosemirrorPlugins: [
    new Plugin<string[]>({
      key: MARQUEE_KEY,
      state: {
        init: () => [],
        apply: (tr, ids) => tr.getMeta(MARQUEE_KEY) ?? ids,
      },
      props: {
        decorations(state) {
          const ids = new Set(MARQUEE_KEY.getState(state));
          if (ids.size === 0) return DecorationSet.empty;
          const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.isInGroup("bnBlock") && ids.has(node.attrs.id)) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { [SELECTED_ATTR]: "" }));
              // 고른 블록의 하위는 함께 표시되므로 더 내려가지 않음
              return false;
            }
            return true;
          });
          return DecorationSet.create(state.doc, decorations);
        },
        attributes: (state): Record<string, string> => ((MARQUEE_KEY.getState(state)?.length ?? 0) > 0 ? { class: ACTIVE_CLASS } : {}),
      },
    }),
  ],
}));
// 사각형을 그리는 동안 html에 붙임 (블록 손잡이 숨김)
const DRAGGING_CLASS = "block-marquee-dragging";
const DRAG_THRESHOLD = 4;
// 블록 손잡이(끌기 버튼)
const HANDLE = ".bn-side-menu [draggable='true']";

// 노션처럼 블록 바깥(손잡이 왼쪽 여백 등)에서 끌면 사각형으로 여러 블록을 고름
// 고른 블록은 파랗게 표시하고 Delete·Backspace로 지움, Ctrl+C·X로 복사·잘라내기, 손잡이로 함께 끌어 옮김
// 고르는 동안은 편집기 포커스를 빼서 글자를 쳐도 아무 일 없음 (노션과 같음)
export function installBlockMarquee(editor: AnyEditor, area: HTMLElement, signal: AbortSignal): void {
  let start: MarqueeAnchor | undefined;
  // 마지막 마우스 위치 (휠 스크롤 때 이 위치로 사각형을 다시 계산)
  let pointer: { x: number; y: number } = { x: 0, y: 0 };
  let box: HTMLDivElement | undefined;
  let selected: string[] = [];
  // 고른 블록이 있는 채로 손잡이를 누른 상태
  let handlePressed = false;
  const editorRoot = () => area.querySelector<HTMLElement>(".bn-editor");

  // 선택 표시는 편집기 decoration으로 (blockMarqueeExtension)
  // DOM에 속성을 직접 붙이면 ProseMirror가 그 구간을 다시 읽어 새로 그리면서(토글이 있으면 특히) 표시가 지워졌음
  let marked: string[] = [];
  const mark = (ids: string[]) => {
    const view = editor.prosemirrorView;
    // 같은 선택이면 다시 그리지 않음, 편집기를 닫는 중(정리)에는 건드리지 않음
    if ((view as { isDestroyed?: boolean }).isDestroyed || (ids.length === marked.length && ids.every((id, i) => id === marked[i]))) return;
    marked = ids;
    view.dispatch(view.state.tr.setMeta(MARQUEE_KEY, ids).setMeta("addToHistory", false));
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
    const target = e.target instanceof Element ? e.target : null;
    // 고른 블록이 있을 때 손잡이를 누르면 선택을 남겨 둠 (끌면 고른 블록을 함께 옮기고, 끌지 않고 떼거나 끌기가 끝나면 해제)
    // 예전에는 누르는 순간 해제해 손잡이 블록 하나만 옮겨졌고, 직전에 Ctrl+C로 잡힌 편집기 선택이 남아 있을 때만 함께 옮겨져 되다 말다 했음
    if (selected.length > 0 && e.button === 0 && target?.closest(HANDLE)) {
      handlePressed = true;
      return;
    }
    clear();
    const root = editorRoot();
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

  // 손잡이를 누르고 끌지 않고 뗀 경우 (끌기가 시작되면 mouseup 대신 dragend가 옴)
  const releaseHandle = () => {
    if (!handlePressed) return;
    handlePressed = false;
    clear();
  };
  document.addEventListener("dragend", releaseHandle, { signal });

  document.addEventListener("mouseup", () => {
    releaseHandle();
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
    // 글자 조합 중에는 Delete·Esc를 건드리지 않음 (Ctrl·Cmd 조합은 조합 중이라 와도 복사·잘라내기로 처리)
    if (selected.length === 0 || (e.isComposing && !e.ctrlKey && !e.metaKey)) return;
    const ids = selected;
    const action = marqueeKeyAction(e);
    if (action === "delete") {
      e.preventDefault();
      e.stopPropagation();
      clear();
      editor.removeBlocks(ids.filter((id) => editor.getBlock(id)));
      return;
    }
    if (action === "cut") {
      e.preventDefault();
      e.stopPropagation();
      // 블록 범위를 잠깐 선택해 복사한 뒤 블록을 지움
      copyBlocks(editor, ids);
      clear();
      editor.removeBlocks(ids.filter((id) => editor.getBlock(id)));
      return;
    }
    if (action === "copy") {
      e.preventDefault();
      copyBlocks(editor, ids);
      collapseSelection(editor);
      editor.prosemirrorView.dom.blur();
      document.getSelection()?.removeAllRanges();
      return;
    }
    // Esc는 선택 해제, 그 밖의 키는 무시 (편집기 포커스가 없어 글자가 들어가지 않음)
    if (action === "escape") {
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
