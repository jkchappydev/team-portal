import type { CollabConfig } from "./config.js";

export interface BackendClient {
  authorize(documentId: number, ticket: string): Promise<{ userId: number; userName: string }>;
  fetchContent(documentId: number): Promise<Uint8Array | null>;
  storeContent(
    documentId: number,
    state: Uint8Array,
    plainText: string,
    updatedBy: number | null,
    mentionedMemberIds: number[],
  ): Promise<void>;
}

interface ApiBody<T> {
  success: boolean;
  data: T | null;
}

export function createBackendClient(
  config: Pick<CollabConfig, "backendUrl" | "internalToken">,
): BackendClient {
  const headers = { "X-Internal-Token": config.internalToken };

  return {
    // 문서가 없거나(404) 사용자가 유효하지 않으면(401) 접속 불가
    async authorize(documentId, ticket) {
      const url = `${config.backendUrl}/internal/collab/authorize?documentId=${documentId}&ticket=${encodeURIComponent(ticket)}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        throw new Error(`authorize 실패: ${res.status}`);
      }
      const body = (await res.json()) as ApiBody<{ userId: number; userName: string }>;
      if (!body.data) {
        throw new Error("authorize 응답에 data가 없음");
      }
      return body.data;
    },

    // 아직 본문이 없으면 null
    async fetchContent(documentId) {
      const res = await fetch(`${config.backendUrl}/internal/documents/${documentId}/content`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`fetchContent 실패: ${res.status}`);
      }
      const body = (await res.json()) as ApiBody<{ state: string | null }>;
      const state = body.data?.state;
      return state ? new Uint8Array(Buffer.from(state, "base64")) : null;
    },

    async storeContent(documentId, state, plainText, updatedBy, mentionedMemberIds) {
      const res = await fetch(`${config.backendUrl}/internal/documents/${documentId}/content`, {
        method: "PUT",
        signal: AbortSignal.timeout(10_000),
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          state: Buffer.from(state).toString("base64"),
          plainText,
          updatedBy,
          // 본문에서 @로 언급한 팀원 (백엔드가 담당 언급 알림 대상으로 기록)
          mentionedMemberIds,
        }),
      });
      if (!res.ok) {
        throw new Error(`storeContent 실패: ${res.status}`);
      }
    },
  };
}
