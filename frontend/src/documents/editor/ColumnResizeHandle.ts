import type { BlockNoteEditor } from "@blocknote/core";

type AnyEditor = BlockNoteEditor<any, any, any>;

// 열이 이보다 좁아지지 않게 함 (px)
const MIN_COLUMN_PX = 60;

function columnElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.bn-column[data-id="${CSS.escape(id)}"]`);
}

// 끈 거리(dx)만큼 앞 열과 이 열의 너비 비율을 나눔 (두 열 너비 합은 그대로)
export function resizedWidths(
  widths: { previous: number; current: number },
  pixels: { previous: number; current: number },
  dx: number,
): { previous: number; current: number } {
  const totalPx = pixels.previous + pixels.current;
  const totalWidth = widths.previous + widths.current;
  if (totalPx <= 0) return widths;
  const previousPx = Math.min(Math.max(pixels.previous + dx, MIN_COLUMN_PX), totalPx - MIN_COLUMN_PX);
  const previous = (totalWidth * previousPx) / totalPx;
  return { previous, current: totalWidth - previous };
}

// 손잡이 영역 위에 마우스가 있으면 body에 표시를 달아 블록 메뉴(+·⠿)를 숨김
// 블록 메뉴는 편집기 밖 떠 있는 층에 그려져 열 사이 간격의 손잡이를 덮으므로 손잡이 위에서만 비켜 줌
let hoverInstalled = false;
function installResizeHover() {
  if (hoverInstalled) return;
  hoverInstalled = true;
  document.addEventListener("mousemove", (event) => {
    if (document.body.classList.contains("bn-column-resizing")) return;
    const over = Array.from(document.querySelectorAll<HTMLElement>(".bn-column-resize-handle")).some((handle) => {
      const rect = handle.getBoundingClientRect();
      return rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    document.body.classList.toggle("bn-column-resize-hover", over);
  }, { passive: true });
}

// 노션처럼 열 사이 경계를 좌우로 끌어 너비를 바꿈 (끄는 동안은 화면만 바꾸고 놓을 때 저장)
export function createColumnResizeHandle(blockId: string, editor: AnyEditor) {
  const dom = document.createElement("div");
  dom.className = "bn-column-resize-handle";
  dom.contentEditable = "false";
  dom.setAttribute("aria-hidden", "true");
  installResizeHover();
  const onMouseDown = (event: MouseEvent) => {
    if (!editor.isEditable || event.button !== 0) return;
    const parent = editor.getParentBlock(blockId);
    const index = parent?.children.findIndex((child) => child.id === blockId) ?? -1;
    if (!parent || index <= 0) return;
    const previousBlock = parent.children[index - 1];
    const currentBlock = parent.children[index];
    const previousEl = columnElement(previousBlock.id);
    const currentEl = columnElement(currentBlock.id);
    if (!previousEl || !currentEl) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const widths = { previous: Number(previousBlock.props.width) || 1, current: Number(currentBlock.props.width) || 1 };
    const pixels = { previous: previousEl.getBoundingClientRect().width, current: currentEl.getBoundingClientRect().width };
    let next = widths;
    document.body.classList.add("bn-column-resizing");
    const onMove = (move: MouseEvent) => {
      next = resizedWidths(widths, pixels, move.clientX - startX);
      previousEl.style.flexGrow = String(next.previous);
      currentEl.style.flexGrow = String(next.current);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("bn-column-resizing");
      if (next === widths) return;
      editor.transact(() => {
        editor.updateBlock(previousBlock.id, { props: { width: next.previous } });
        editor.updateBlock(currentBlock.id, { props: { width: next.current } });
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  dom.addEventListener("mousedown", onMouseDown);
  return { dom, destroy: () => dom.removeEventListener("mousedown", onMouseDown) };
}
