import { Database } from "@hocuspocus/extension-database";
import { type Hocuspocus, Server } from "@hocuspocus/server";
import * as Y from "yjs";
import type { BackendClient } from "./backendClient.js";
import type { CollabConfig } from "./config.js";
import { extractText } from "./extractText.js";

interface ConnectionContext {
  userId: number;
  userName: string;
}

export interface CreateServerOptions {
  debounce?: number;
  maxDebounce?: number;
  retryInterval?: number;
}

const DOCUMENT_NAME = /^document-(\d+)$/;

function parseDocumentId(documentName: string): number | null {
  const match = DOCUMENT_NAME.exec(documentName);
  return match ? Number(match[1]) : null;
}

export function createServer(
  config: CollabConfig,
  client: BackendClient,
  options: CreateServerOptions = {},
): Server<ConnectionContext> {
  const retryInterval = options.retryInterval ?? 5000;
  // 저장에 실패한 문서 이름 → 마지막 편집자 ID (저장 성공 전까지 언로드 금지)
  const failedDocuments = new Map<string, number | null>();
  let retryTimer: NodeJS.Timeout | undefined;
  let instance: Hocuspocus<ConnectionContext> | undefined;

  const stopRetry = () => {
    clearInterval(retryTimer);
    retryTimer = undefined;
  };

  // 실패 문서의 현재 전체 상태를 다시 저장하고, 성공하면 접속자가 없을 때 언로드
  const retryFailedDocuments = async () => {
    for (const [documentName, updatedBy] of failedDocuments) {
      const document = instance?.documents.get(documentName);
      const documentId = parseDocumentId(documentName);
      if (!instance || !document || documentId === null) {
        failedDocuments.delete(documentName);
        continue;
      }
      try {
        await document.saveMutex.runExclusive(async () => {
          // 대기 중 정상 저장이 성공했으면 건너뜀
          if (!failedDocuments.has(documentName)) {
            return;
          }
          await client.storeContent(
            documentId,
            Y.encodeStateAsUpdate(document),
            extractText(document),
            updatedBy,
          );
          failedDocuments.delete(documentName);
        });
      } catch (error) {
        console.error(`[collab] ${documentName} 저장 재시도 실패`, error);
        continue;
      }
      if (instance.shouldUnloadDocument(document)) {
        await instance.unloadDocument(document);
      }
    }
    if (failedDocuments.size === 0) {
      stopRetry();
    }
  };

  const scheduleRetry = () => {
    if (retryTimer) {
      return;
    }
    let running = false;
    retryTimer = setInterval(() => {
      if (running) {
        return;
      }
      running = true;
      retryFailedDocuments().finally(() => {
        running = false;
      });
    }, retryInterval);
    retryTimer.unref();
  };

  const server = new Server<ConnectionContext>({
    port: config.port,
    quiet: true,
    stopOnSignals: false,
    debounce: options.debounce ?? 2000,
    maxDebounce: options.maxDebounce ?? 10000,

    // 문서 이름 형식과 사용자·문서 유효성을 backend에 확인
    async onAuthenticate({ documentName, token }) {
      const documentId = parseDocumentId(documentName);
      if (documentId === null || !token) {
        throw new Error("잘못된 접속 정보");
      }
      const { userId, userName } = await client.authorize(documentId, token);
      return { userId, userName };
    },

    // 저장 실패 문서는 throw로 언로드를 중단시켜 메모리의 변경을 보존
    async beforeUnloadDocument({ documentName }) {
      if (failedDocuments.has(documentName)) {
        throw new Error(`${documentName} 저장 전이라 언로드 보류`);
      }
    },

    async onDestroy() {
      stopRetry();
    },

    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          const documentId = parseDocumentId(documentName);
          return documentId === null ? null : client.fetchContent(documentId);
        },
        // 실패하면 재시도 대상으로 등록하고 재던짐(Hocuspocus는 재시도하지 않음)
        store: async ({ documentName, state, document, lastContext }) => {
          const documentId = parseDocumentId(documentName);
          if (documentId === null) {
            return;
          }
          const updatedBy = lastContext?.userId ?? null;
          try {
            await client.storeContent(documentId, state, extractText(document as Y.Doc), updatedBy);
            failedDocuments.delete(documentName);
          } catch (error) {
            console.error(`[collab] ${documentName} 저장 실패`, error);
            failedDocuments.set(documentName, updatedBy ?? failedDocuments.get(documentName) ?? null);
            scheduleRetry();
            throw error;
          }
        },
      }),
    ],
  });
  instance = server.hocuspocus;
  return server;
}
