import type { DragEvent } from "react";

// 일정표 줄을 끌 때 싣는 데이터 형식 (본문 편집기 블록 끌기와 구분)
export const WBS_DRAG_TYPE = "application/x-portal-wbs-task";

const DRAG_EVENTS = ["dragenter", "dragover", "dragleave", "drop"] as const;

function isWbsDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes(WBS_DRAG_TYPE);
}

// 일정표 안: 일정표가 끌기를 처리한 뒤 본문 편집기로 올라가지 않게 막음
// (편집기가 받으면 블록을 옮기는 줄 알고 본문 블록 사이에 파란 놓기 선을 그림)
export function stopWbsDragAtBoard(event: DragEvent) {
  if (isWbsDrag(event)) event.nativeEvent.stopPropagation();
}

// 일정표 밖: 일정표 줄은 밖에 놓을 수 없으므로 끄는 동안 다른 곳(본문 편집기 등)이 반응하지 않게 막음
// 끌기를 시작할 때 걸고 끝날 때 해제
export function blockWbsDragOutside(board: HTMLElement): () => void {
  const block = (event: globalThis.DragEvent) => {
    if (!isWbsDrag(event)) return;
    if (event.target instanceof Node && board.contains(event.target)) return;
    event.stopPropagation();
  };
  for (const type of DRAG_EVENTS) window.addEventListener(type, block, true);
  return () => {
    for (const type of DRAG_EVENTS) window.removeEventListener(type, block, true);
  };
}
