import * as Y from "yjs";

// 이름표를 보여주는 시간 (BlockNote 기본과 같은 2초)
export const CURSOR_ACTIVE_MS = 2000;

// 협업 커서에 싣는 사용자 정보 (memberId로 커서 요소와 실제 편집자를 맞춤)
export interface CursorUser {
  name: string;
  color: string;
  memberId?: number;
}

// 문서 변경 묶음에서 글을 넣거나 서식을 바꾼 접속(클라이언트) ID
// 삭제 기록에는 지운 사람이 아니라 원래 글쓴이 ID가 남아 엉뚱한 이름이 뜰 수 있으므로 쓰지 않음
export function editingClientIds(update: Uint8Array): number[] {
  const { structs } = Y.decodeUpdate(update);
  return [...new Set(structs.map((struct) => struct.id.client))];
}

// BlockNote 기본 커서와 같은 모양에 누구의 커서인지(data-member-id) 표시
export function renderCursor(user: CursorUser): HTMLElement {
  const base = document.createElement("span");
  base.classList.add("bn-collaboration-cursor__base");
  if (user.memberId != null) base.dataset.memberId = String(user.memberId);

  const caret = document.createElement("span");
  caret.setAttribute("contenteditable", "false");
  caret.classList.add("bn-collaboration-cursor__caret");
  caret.setAttribute("style", `background-color: ${user.color}; color: white`);

  const label = document.createElement("span");
  label.classList.add("bn-collaboration-cursor__label");
  label.setAttribute("style", `background-color: ${user.color}; color: white`);
  label.textContent = user.name;

  caret.appendChild(label);
  base.append(document.createTextNode("⁠"), caret, document.createTextNode("⁠"));

  // 커서에 마우스를 올리면 이름 확인
  let hoverTimer: number | undefined;
  base.addEventListener("mouseenter", () => {
    window.clearTimeout(hoverTimer);
    base.setAttribute("data-active", "");
  });
  base.addEventListener("mouseleave", () => {
    hoverTimer = window.setTimeout(() => base.removeAttribute("data-active"), CURSOR_ACTIVE_MS);
  });
  return base;
}

// 실제로 글을 고친 팀원의 커서에만 잠깐 이름표를 띄움
// (커서 위치 정보만 바뀐 경우는 띄우지 않아, 남이 입력할 때 가만히 있던 사람 이름이 뜨는 문제 방지)
export function createCursorActivity(container: HTMLElement) {
  const timers = new Map<number, number>();
  return {
    activate(memberId: number) {
      const cursors = container.querySelectorAll<HTMLElement>(`.bn-collaboration-cursor__base[data-member-id="${memberId}"]`);
      cursors.forEach((cursor) => cursor.setAttribute("data-active", ""));
      window.clearTimeout(timers.get(memberId));
      timers.set(memberId, window.setTimeout(() => {
        container.querySelectorAll<HTMLElement>(`.bn-collaboration-cursor__base[data-member-id="${memberId}"]`)
          .forEach((cursor) => cursor.removeAttribute("data-active"));
        timers.delete(memberId);
      }, CURSOR_ACTIVE_MS));
    },
    dispose() {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    },
  };
}
