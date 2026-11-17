import { strFromU8 } from "fflate";
import { uploadAttachment } from "../../api/attachments";
import { changeDocumentIcon, createDocument, renameDocument } from "../../api/documents";
import { saveHistoryCheckpoint } from "../../api/history";
import { TABLE_OPTIONS, waitUntilSynced, withSyncedDocument } from "../collabSession";
import { bytesToBase64 } from "../history/versionContent";
import { archiveFile, buildPageTree, readNotionFiles } from "./notionArchive";
import type { ArchiveFiles, NotionPageNode } from "./notionArchive";
import { convertNotionBody, readPageInfo } from "./notionHtml";
import type { ImportBlock } from "./notionHtml";

// 서버 업로드 한도 (application.yml MAX_UPLOAD_SIZE 기본값)
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_TITLE = "제목 없음";

export interface ImportTarget {
  spaceId: number;
  // 노션 최상위 페이지 내용을 넣을 문서 (하위 페이지는 이 문서 아래에 만듦)
  documentId: number;
  title: string;
  icon: string | null;
  // 프로젝트 본문이면 false (프로젝트 이름·아이콘은 따로 관리해 노션 제목·아이콘으로 바꾸지 않음)
  applyTitle: boolean;
}

export interface ImportProgress {
  done: number;
  total: number;
  current: string;
}

export interface ImportResult {
  pages: number;
  files: number;
  skipped: string[];
}

// 문서 본문에 블록을 씀: 대상 문서는 기존 본문 뒤에 이어 붙이고(빈 줄 하나뿐이면 바꿈) 그 전에 수정 이력에 지금 본문을 남김
async function writeBlocks(documentId: number, blocks: ImportBlock[], append: boolean): Promise<void> {
  const { blocksToYXmlFragment, yXmlFragmentToBlocks } = await import("@blocknote/core/yjs");
  await withSyncedDocument(documentId, async ({ Y, doc, fragment, provider, editor }) => {
    let existing: unknown[] = [];
    if (append) {
      existing = yXmlFragmentToBlocks(editor, fragment) as unknown[];
      const onlyEmpty = existing.length === 1 && (existing[0] as { type: string; content?: unknown[]; children?: unknown[] }).type === "paragraph"
        && !((existing[0] as { content?: unknown[] }).content?.length) && !((existing[0] as { children?: unknown[] }).children?.length);
      if (onlyEmpty) existing = [];
      if (existing.length > 0) {
        await saveHistoryCheckpoint(documentId, bytesToBase64(Y.encodeStateAsUpdate(doc)));
      }
    }
    blocksToYXmlFragment(editor, [...existing, ...blocks] as never, fragment);
    await waitUntilSynced(provider);
  });
}

function countPages(nodes: NotionPageNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countPages(node.children), 0);
}

// 노션 내보내기(HTML, ZIP 또는 HTML 하나)를 대상 문서와 그 아래 페이지로 가져옴
export async function importNotion(file: File, target: ImportTarget, onProgress?: (progress: ImportProgress) => void): Promise<ImportResult> {
  const files: ArchiveFiles = await readNotionFiles(file);
  const roots = buildPageTree(files);
  if (roots.length === 0) throw new Error("노션에서 HTML로 내보낸 파일(.zip 또는 .html)이 아닙니다.");

  const { BlockNoteEditor } = await import("@blocknote/core");
  const { editorSchema } = await import("../editor/schema");
  const parser = BlockNoteEditor.create({ schema: editorSchema, tables: TABLE_OPTIONS });
  const parseHtml = (html: string) => parser.tryParseHTMLToBlocks(html) as unknown as ImportBlock[];

  const total = countPages(roots);
  const result: ImportResult = { pages: 0, files: 0, skipped: [] };
  const pageIds = new Map<string, number>();
  let done = 0;

  // 페이지 하나: 하위 페이지 문서를 먼저 만들고(본문 링크 순서, 링크 없는 것은 뒤) 파일을 올린 뒤 본문을 씀
  const importPage = async (node: NotionPageNode, documentId: number, isTarget: boolean): Promise<void> => {
    const html = strFromU8(files.get(node.path)!);
    const info = readPageInfo(html, node.path);
    onProgress?.({ done, total, current: info.title || node.fileTitle });

    const linked = info.childLinks.map((path) => node.children.find((child) => child.path === path)).filter((c): c is NotionPageNode => !!c);
    const ordered = [...linked, ...node.children.filter((child) => !linked.includes(child))];
    for (const child of ordered) {
      const childInfo = readPageInfo(strFromU8(files.get(child.path)!), child.path);
      const created = await createDocument(target.spaceId, documentId, childInfo.title || child.fileTitle);
      pageIds.set(child.path, created.id);
      if (childInfo.icon) await changeDocumentIcon(created.id, childInfo.icon).catch(() => undefined);
    }

    const urls = new Map<string, string>();
    for (const path of info.assets) {
      const data = files.get(path);
      if (!data) continue;
      if (data.byteLength > MAX_UPLOAD_BYTES) continue;
      try {
        const uploaded = await uploadAttachment(documentId, archiveFile(path, data), true);
        urls.set(path, uploaded.url);
        result.files += 1;
      } catch {
        // 올리지 못한 파일은 건너뛴 목록에 남김 (변환 때 기록)
      }
    }

    const skipped: string[] = [];
    const blocks = convertNotionBody(html, {
      pagePath: node.path,
      pageIdFor: (path) => pageIds.get(path),
      assetUrl: (path) => urls.get(path),
      parseHtml,
      skipped,
    });
    // 본문에 링크가 없던 하위 페이지는 맨 아래에 페이지 블록으로 연결
    for (const child of ordered.filter((c) => !linked.includes(c))) {
      blocks.push({ type: "page", props: { documentId: pageIds.get(child.path)! } });
    }
    result.skipped.push(...skipped.map((name) => `${info.title || node.fileTitle}: ${name}`));
    await writeBlocks(documentId, blocks, isTarget);
    result.pages += 1;
    done += 1;
    onProgress?.({ done, total, current: info.title || node.fileTitle });

    for (const child of ordered) await importPage(child, pageIds.get(child.path)!, false);
  };

  if (roots.length === 1) {
    // 최상위 페이지 하나: 그 내용을 대상 문서에 넣고, 제목이 기본값이거나 아이콘이 없으면 노션 것으로
    const info = readPageInfo(strFromU8(files.get(roots[0].path)!), roots[0].path);
    if (target.applyTitle && target.title.trim() === DEFAULT_TITLE && info.title) await renameDocument(target.documentId, info.title);
    if (target.applyTitle && !target.icon && info.icon) await changeDocumentIcon(target.documentId, info.icon).catch(() => undefined);
    await importPage(roots[0], target.documentId, true);
  } else {
    // 최상위 페이지가 여럿이면 각각 대상 문서 아래 페이지로 만들고 대상 본문 끝에 연결
    const created: ImportBlock[] = [];
    for (const root of roots) {
      const info = readPageInfo(strFromU8(files.get(root.path)!), root.path);
      const doc = await createDocument(target.spaceId, target.documentId, info.title || root.fileTitle);
      pageIds.set(root.path, doc.id);
      if (info.icon) await changeDocumentIcon(doc.id, info.icon).catch(() => undefined);
      created.push({ type: "page", props: { documentId: doc.id } });
    }
    await writeBlocks(target.documentId, created, true);
    for (const root of roots) await importPage(root, pageIds.get(root.path)!, false);
  }
  return result;
}
