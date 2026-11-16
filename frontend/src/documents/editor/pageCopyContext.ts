import { createContext, useContext } from "react";

// 블록 메뉴 "복제"에서 페이지 블록을 페이지째 복사할 때 쓰는 편집기 쪽 기능
export interface PageCopyActions {
  // 페이지 사본을 만들고 새 문서 ID를 돌려줌
  copyPage: (documentId: number) => Promise<number>;
  // 사본을 만들지 못했을 때 본문 위 안내 칸에 보여 줄 문구
  onError: (message: string) => void;
}

export const PageCopyContext = createContext<PageCopyActions | null>(null);

export function usePageCopy(): PageCopyActions | null {
  return useContext(PageCopyContext);
}
