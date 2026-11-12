import { createExtension } from "@blocknote/core";

// 끄는 동안 화면 전체 커서를 잡는 손(grab)으로 고정하는 클래스 (index.css)
export const HANDLE_DRAG_CLASS = "table-handle-dragging-cursor";
// 이만큼 움직여야 끌기로 봄 (그보다 작으면 클릭 = 손잡이 메뉴)
const DRAG_THRESHOLD = 3;

// 끌기 이벤트 (BlockNote가 읽는 좌표와 끌기 데이터만 채움)
function dragEvent(type: string, x: number, y: number): DragEvent {
  return new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: new DataTransfer() });
}

// 좌표 아래 요소에 끌기 이벤트 전달 (BlockNote는 문서 전체에서 dragover·drop을 들음)
function dispatchAt(type: string, x: number, y: number): void {
  (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(dragEvent(type, x, y));
}

// 표 행·열 손잡이 끌기를 브라우저 기본 끌어 놓기 대신 마우스 이동으로 진행
// 기본 끌어 놓기는 끄는 동안 브라우저가 커서를 정해 잡는 손 커서를 쓸 수 없어서,
// 진짜 dragstart는 막고 BlockNote가 듣는 dragstart → dragover → drop → dragend를 같은 순서로 직접 보냄 (행·열 이동 로직은 BlockNote 그대로)
export function installTableHandleDrag(container: HTMLElement, signal: AbortSignal): void {
  let pending: { handle: HTMLElement; x: number; y: number } | undefined;
  let dragging: HTMLElement | undefined;
  let lastPoint = { x: 0, y: 0 };

  const handleOf = (target: EventTarget | null) => {
    const handle = target instanceof Element ? target.closest<HTMLElement>(".bn-table-handle") : null;
    // 병합된 칸이 있어 끌 수 없는 손잡이는 BlockNote가 draggable을 끔
    return handle && container.contains(handle) && handle.getAttribute("draggable") === "true" ? handle : undefined;
  };

  const finish = () => {
    pending = undefined;
    dragging = undefined;
    document.documentElement.classList.remove(HANDLE_DRAG_CLASS);
  };

  document.addEventListener("mousedown", (e) => {
    const handle = e.button === 0 ? handleOf(e.target) : undefined;
    if (handle) pending = { handle, x: e.clientX, y: e.clientY };
  }, { capture: true, signal });

  // 브라우저 기본 끌어 놓기 시작은 막음 (직접 보낸 dragstart는 통과)
  document.addEventListener("dragstart", (e) => {
    if (e.isTrusted && handleOf(e.target)) e.preventDefault();
  }, { capture: true, signal });

  document.addEventListener("mousemove", (e) => {
    lastPoint = { x: e.clientX, y: e.clientY };
    if (pending && !dragging) {
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD) return;
      dragging = pending.handle;
      document.documentElement.classList.add(HANDLE_DRAG_CLASS);
      dragging.dispatchEvent(dragEvent("dragstart", pending.x, pending.y));
    }
    if (dragging) {
      e.preventDefault();
      dispatchAt("dragover", e.clientX, e.clientY);
    }
  }, { capture: true, signal });

  document.addEventListener("mouseup", (e) => {
    const handle = dragging;
    if (!handle) {
      pending = undefined;
      return;
    }
    finish();
    dispatchAt("drop", e.clientX, e.clientY);
    handle.dispatchEvent(dragEvent("dragend", e.clientX, e.clientY));
    // 끈 뒤 손잡이 위에서 놓아도 손잡이 메뉴가 열리지 않게 이번 클릭은 버림
    // (놓은 직후 클릭이 오지 않는 경우 다음 클릭을 버리지 않도록 바로 다음 차례에 해제)
    const swallowClick = (click: MouseEvent) => {
      click.preventDefault();
      click.stopPropagation();
    };
    document.addEventListener("click", swallowClick, { capture: true, once: true, signal });
    setTimeout(() => document.removeEventListener("click", swallowClick, { capture: true }), 0);
  }, { capture: true, signal });

  // 창 밖에서 놓는 등 끌기가 끊기면 원래 자리에 둔 것으로 끝냄
  window.addEventListener("blur", () => {
    const handle = dragging;
    if (!handle) return;
    finish();
    handle.dispatchEvent(dragEvent("dragend", lastPoint.x, lastPoint.y));
  }, { signal });
}

export const tableHandleDragExtension = createExtension({
  key: "tableHandleDrag",
  mount: ({ dom, signal }) => {
    // 손잡이는 편집 영역 밖(편집기 바깥 상자)에 그려지므로 편집기 전체 상자 기준으로 찾음
    installTableHandleDrag(dom.closest<HTMLElement>(".bn-container") ?? dom, signal);
  },
});
