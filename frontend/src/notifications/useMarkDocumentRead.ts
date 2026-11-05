import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { markDocumentRead } from "../api/notifications";

export const DOCUMENT_UPDATES_KEY = ["documentUpdates"];

// 페이지를 열 때와 떠날 때 확인 처리 (보는 동안 들어온 수정도 알림에 남지 않게 함)
export function useMarkDocumentRead(documentId: number | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!documentId) return;
    const mark = () => {
      markDocumentRead(documentId)
        .then(() => queryClient.invalidateQueries({ queryKey: DOCUMENT_UPDATES_KEY }))
        .catch(() => {
          // 삭제된 페이지 등은 알림 확인 처리 생략
        });
    };
    mark();
    return mark;
  }, [documentId, queryClient]);
}
