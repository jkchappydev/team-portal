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
