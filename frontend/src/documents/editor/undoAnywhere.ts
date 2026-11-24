import { createExtension } from "@blocknote/core";

export type UndoAction = "undo" | "redo" | null;

// Ctrl(Cmd)+Z는 되돌리기, Ctrl+Y·Ctrl+Shift+Z는 다시 실행 (한글 입력 상태에서는 key가 "ㅋ" 등으로 오므로 자판 위치 code로 판단)
export function undoAction(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): UndoAction {
  if ((!e.ctrlKey && !e.metaKey) || e.altKey) return null;
  const isZ = e.code === "KeyZ" || e.key.toLowerCase() === "z";
  const isY = e.code === "KeyY" || e.key.toLowerCase() === "y";
  if (isZ) return e.shiftKey ? "redo" : "undo";
  if (isY && !e.shiftKey) return "redo";
  return null;
}

// 글을 입력하는 곳(입력 칸·편집 영역)이나 대화 상자 안이면 그쪽 되돌리기에 맡김
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']");
}

// 노션처럼 편집기 글 안에 커서가 없어도 페이지에서 Ctrl+Z·Ctrl+Y로 본문을 되돌림
// 블록을 끌어 놓거나 고른 블록을 지우면 편집기 포커스가 빠져, 예전에는 아무 줄이나 눌러 커서를 둔 뒤에야 되돌릴 수 있었음
export const undoAnywhereExtension = createExtension(({ editor }) => ({
  key: "undoAnywhere",
  mount: ({ signal }) => {
    window.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.isComposing || !editor.isEditable || isTypingTarget(e.target)) return;
      const action = undoAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === "undo") editor.undo();
      else editor.redo();
    }, { signal });
  },
}));
