import type { BlockNoteEditor } from "@blocknote/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as YType from "yjs";
import { collabUrl, FRAGMENT_NAME } from "./collab";
import { fetchCollabTicket } from "../api/collab";

// 협업 서버 응답을 기다리는 최대 시간
const SYNC_TIMEOUT_MS = 15000;

// 편집기 화면과 같은 표 기능을 켠 상태로 블록을 읽고 써야 색·제목 행이 보존됨
export const TABLE_OPTIONS = { cellBackgroundColor: true, cellTextColor: true, headers: true, splitCells: true };

export interface SyncedDocument {
  Y: typeof YType;
  doc: YType.Doc;
  fragment: YType.XmlFragment;
  provider: HocuspocusProvider;
  // 블록 변환용 편집기 (화면에 붙이지 않음)
  editor: BlockNoteEditor;
}

// 편집기를 열지 않은 화면에서도 협업 서버에 잠깐 접속해 본문을 다룸 (끝나면 연결 해제)
export async function withSyncedDocument<T>(
  documentId: number,
  work: (session: SyncedDocument) => T | Promise<T>,
): Promise<T> {
  const [{ HocuspocusProvider }, Y, { BlockNoteEditor }] = await Promise.all([
    import("@hocuspocus/provider"),
    import("yjs"),
    import("@blocknote/core"),
  ]);
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: collabUrl(),
    name: `document-${documentId}`,
    token: fetchCollabTicket,
    document: doc,
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("본문을 불러오는 데 시간이 너무 오래 걸립니다.")), SYNC_TIMEOUT_MS);
      provider.on("synced", ({ state }: { state: boolean }) => {
        if (!state) return;
        window.clearTimeout(timer);
        resolve();
      });
      provider.on("authenticationFailed", () => {
        window.clearTimeout(timer);
        reject(new Error("본문에 접속하지 못했습니다."));
      });
    });
    const editor = BlockNoteEditor.create({ tables: TABLE_OPTIONS }) as unknown as BlockNoteEditor;
    return await work({ Y, doc, fragment: doc.getXmlFragment(FRAGMENT_NAME), provider, editor });
  } finally {
    provider.destroy();
    doc.destroy();
  }
}

// 이쪽에서 바꾼 내용이 협업 서버에 모두 반영될 때까지 대기
export function waitUntilSynced(provider: HocuspocusProvider): Promise<void> {
  if (!provider.hasUnsyncedChanges) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      provider.off("unsyncedChanges", onChange);
      reject(new Error("변경 내용을 서버에 저장하지 못했습니다."));
    }, SYNC_TIMEOUT_MS);
    const onChange = () => {
      if (provider.hasUnsyncedChanges) return;
      window.clearTimeout(timer);
      provider.off("unsyncedChanges", onChange);
      resolve();
    };
    provider.on("unsyncedChanges", onChange);
  });
}
