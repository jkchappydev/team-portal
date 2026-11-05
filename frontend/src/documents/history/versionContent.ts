import type { Block } from "@blocknote/core";
import { saveHistoryCheckpoint } from "../../api/history";
import { TABLE_OPTIONS, waitUntilSynced, withSyncedDocument } from "../collabSession";
import { FRAGMENT_NAME } from "../collab";

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // 큰 본문도 호출 스택을 넘기지 않게 나눠서 변환
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// 저장된 사본(Yjs 상태)을 편집기 블록으로 변환
export async function versionToBlocks(contentState: string): Promise<Block[]> {
  const [Y, { BlockNoteEditor }, { yXmlFragmentToBlocks }] = await Promise.all([
    import("yjs"),
    import("@blocknote/core"),
    import("@blocknote/core/yjs"),
  ]);
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, base64ToBytes(contentState));
    const editor = BlockNoteEditor.create({ tables: TABLE_OPTIONS });
    return yXmlFragmentToBlocks(editor, doc.getXmlFragment(FRAGMENT_NAME)) as unknown as Block[];
  } finally {
    doc.destroy();
  }
}

// 지금 본문을 사본으로 남긴 뒤 협업 본문을 고른 버전 내용으로 바꿈 (열린 편집기에는 공동 편집으로 반영)
export async function restoreVersion(documentId: number, userId: number, contentState: string): Promise<void> {
  const blocks = await versionToBlocks(contentState);
  const { blocksToYXmlFragment } = await import("@blocknote/core/yjs");
  await withSyncedDocument(documentId, userId, async ({ Y, doc, fragment, provider, editor }) => {
    await saveHistoryCheckpoint(documentId, bytesToBase64(Y.encodeStateAsUpdate(doc)));
    blocksToYXmlFragment(editor, blocks as never, fragment);
    await waitUntilSynced(provider);
  });
}
