import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

// 서버가 알리는 변경 종류 (백엔드 LiveUpdateEvent와 같은 값)
export const LIVE_TOPICS = { workStatus: "work-status" } as const;

// 화면이 열려 있는 동안 서버의 변경 알림(SSE)을 받아 해당 데이터를 다시 불러옴
// 끊겼다 다시 연결되면 그 사이 놓친 변경이 있을 수 있어 한 번 더 불러옴
export function useLiveRefresh(topic: string, queryKeys: QueryKey[]): void {
  const queryClient = useQueryClient();
  // 배열이 렌더마다 새로 만들어져도 연결을 다시 열지 않도록 문자열로 비교
  const keys = JSON.stringify(queryKeys);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const refresh = () => {
      for (const queryKey of JSON.parse(keys) as QueryKey[]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    const source = new EventSource("/api/live");
    let opened = false;
    const onOpen = () => {
      if (opened) refresh();
      opened = true;
    };
    source.addEventListener("open", onOpen);
    source.addEventListener(topic, refresh);
    return () => {
      source.removeEventListener("open", onOpen);
      source.removeEventListener(topic, refresh);
      source.close();
    };
  }, [queryClient, topic, keys]);
}
