// 블록 메뉴가 열려 있는 동안 노션처럼 그 블록 전체를 파랗게 선택 표시 (해제 함수를 돌려줌)
export function markMenuBlock(blockId: string): () => void {
  const block = document.querySelector<HTMLElement>(`.bn-editor .bn-block[data-id="${CSS.escape(blockId)}"]`);
  block?.setAttribute("data-menu-selected", "");
  return () => block?.removeAttribute("data-menu-selected");
}

// 메뉴가 열려 있을 때 블록을 지우는 키 (한글 조합 중 입력은 제외)
export function isDeleteKey(event: Pick<KeyboardEvent, "key" | "isComposing">): boolean {
  return !event.isComposing && (event.key === "Delete" || event.key === "Backspace");
}
