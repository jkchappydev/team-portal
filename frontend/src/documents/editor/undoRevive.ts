import type { UndoManager } from "yjs";

// 되돌리기(Ctrl+Z) 기록 관리자 복구
// 편집 화면이 떼었다 다시 붙으면(React StrictMode 개발 환경 등) y-prosemirror가 화면을 정리하며 관리자를 파괴하고,
// 같은 편집기 상태를 다시 쓰는 새 화면에서는 관리자를 새로 만들지 않아 이후 입력이 기록되지 않음
// 파괴된 관리자(자기 자신을 추적 대상에서 뺀 상태)만 같은 문서의 변경 감시에 다시 연결
export function reviveUndoManager(undoManager: UndoManager | undefined): boolean {
  if (!undoManager || undoManager.trackedOrigins.has(undoManager)) return false;
  undoManager.trackedOrigins.add(undoManager);
  undoManager.doc.on("afterTransaction", undoManager.afterTransactionHandler);
  return true;
}
