// 새로 만든 페이지로 이동할 때 넘기는 화면 상태. 해당 페이지 화면이 제목 칸에 바로 포커스를 줌
export interface TitleFocusState {
  focusTitle: number;
}

export function focusTitleState(documentId: number): { state: TitleFocusState } {
  return { state: { focusTitle: documentId } };
}

export function shouldFocusTitle(state: unknown, documentId: number): boolean {
  return typeof state === "object" && state !== null && (state as Partial<TitleFocusState>).focusTitle === documentId;
}

// 노션처럼 새로 만든 페이지로 바로 이동하고 제목 칸에 커서를 둠
// 지금 문서에 넣은 페이지 블록이 협업 서버에 저장된 뒤 이동 (저장 확인이 실패해도 이동, 빠진 블록은 서버의 페이지 블록 보충이 채움)
export function openCreatedPage(
  waitSaved: () => Promise<void>,
  navigate: (path: string, options: { state: TitleFocusState }) => void,
  documentId: number,
): Promise<void> {
  return waitSaved().catch(() => undefined).then(() => navigate(`/documents/${documentId}`, focusTitleState(documentId)));
}
