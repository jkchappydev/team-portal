// 본문에서 페이지 블록을 지우면 노션처럼 그 페이지를 휴지통으로 보냄 (메인 최근 수정된 게시글·주소 접근에서도 빠짐)
// 되돌리기(Ctrl+Z)로 블록이 돌아오면 페이지를 복원
// 끌어 옮기기처럼 지웠다가 바로 다시 넣는 변경도 있어, 잠시 기다린 뒤 본문 어디에도 없을 때만 휴지통으로 보냄

export interface PageRemovalActions {
  // 지금 본문의 페이지 블록이 가리키는 문서 ID
  referencedIds: () => Set<number>;
  // 잘라내 붙여넣기를 기다리는 페이지인지
  isCut: (pageId: number) => boolean;
  trashPage: (pageId: number) => Promise<void>;
  restorePage: (pageId: number) => Promise<void>;
  onError: (message: string) => void;
}

export interface PageRemovalTracker {
  removed: (pageIds: number[]) => void;
  restored: (pageIds: number[]) => void;
  // 남은 확인을 바로 처리하고 정리 (본문을 떠날 때)
  dispose: () => void;
}

export function createPageRemovalTracker(documentId: number, actions: PageRemovalActions, delayMs = 600): PageRemovalTracker {
  const pending = new Set<number>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (pending.size === 0) return;
    let referenced: Set<number>;
    try {
      referenced = actions.referencedIds();
    } catch {
      // 본문을 읽을 수 없으면(편집기 정리 중) 잘못 지우지 않도록 그만둠
      pending.clear();
      return;
    }
    const targets = [...pending].filter((id) => id !== documentId && !referenced.has(id) && !actions.isCut(id));
    pending.clear();
    for (const id of targets) {
      actions.trashPage(id).catch((error: unknown) =>
        actions.onError(error instanceof Error && error.message ? error.message : "지운 페이지를 휴지통으로 보내지 못했습니다."));
    }
  };

  return {
    removed: (pageIds) => {
      if (pageIds.length === 0) return;
      pageIds.forEach((id) => pending.add(id));
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    restored: (pageIds) => {
      for (const id of pageIds) {
        // 아직 휴지통으로 보내기 전이면 보내지 않고 끝
        if (pending.delete(id)) continue;
        // 휴지통에 없는 페이지면 서버가 거절하므로 오류는 무시
        actions.restorePage(id).catch(() => undefined);
      }
    },
    dispose: () => {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}
