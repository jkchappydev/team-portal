import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { strToU8, zipSync } from "fflate";

// 문서별 협업 본문 (실제 Yjs 문서에 써서 결과를 블록으로 읽음)
const docs = new Map<number, Y.Doc>();
let nextId = 500;

vi.mock("../../api/documents", () => ({
  createDocument: vi.fn(async (_spaceId: number, parentId: number, title: string) => ({ id: nextId++, parentId, title })),
  renameDocument: vi.fn(async () => ({})),
  changeDocumentIcon: vi.fn(async () => ({})),
}));
vi.mock("../../api/attachments", () => ({
  uploadAttachment: vi.fn(async (_documentId: number, file: File) => ({ url: `/api/attachments/${file.name}/download` })),
}));
vi.mock("../../api/history", () => ({ saveHistoryCheckpoint: vi.fn(async () => ({})) }));
vi.mock("../collabSession", async (importOriginal) => {
  const original = await importOriginal<typeof import("../collabSession")>();
  const { BlockNoteEditor } = await import("@blocknote/core");
  const { editorSchema } = await import("../editor/schema");
  return {
    ...original,
    waitUntilSynced: vi.fn(async () => undefined),
    withSyncedDocument: vi.fn(async (documentId: number, work: (session: unknown) => unknown) => {
      if (!docs.has(documentId)) docs.set(documentId, new Y.Doc());
      const doc = docs.get(documentId)!;
      const editor = BlockNoteEditor.create({ schema: editorSchema, tables: original.TABLE_OPTIONS });
      return work({ Y, doc, fragment: doc.getXmlFragment("document-store"), provider: {}, editor });
    }),
  };
});

const { importNotion } = await import("./importNotion");
const documentsApi = await import("../../api/documents");
const historyApi = await import("../../api/history");
const { yXmlFragmentToBlocks, blocksToYXmlFragment } = await import("@blocknote/core/yjs");
const { BlockNoteEditor } = await import("@blocknote/core");
const { editorSchema } = await import("../editor/schema");

const reader = BlockNoteEditor.create({ schema: editorSchema });
function blocksOf(id: number) {
  return yXmlFragmentToBlocks(reader, docs.get(id)!.getXmlFragment("document-store")) as unknown as { type: string; props: Record<string, unknown>; content?: { text?: string }[] }[];
}

const page = (title: string, icon: string | null, body: string) => `<html><body><article class="page sans"><header>${icon ? `<div class="page-header-icon undefined"><span class="icon">${icon}</span></div>` : ""}<h1 class="page-title">${title}</h1></header><div class="page-body">${body}</div></article></body></html>`;

function exportZip(): File {
  const zip = zipSync({
    "개인 페이지 & 공유된 페이지/회의 0123456789abcdef0123456789abcdef.html": strToU8(page("회의", "📝", `<p>회의 본문</p>
<figure class="image"><img src="%ED%9A%8C%EC%9D%98/image.png"/></figure>
<figure class="link-to-page"><a href="%ED%9A%8C%EC%9D%98/%EC%95%88%EA%B1%B4%20fedcba9876543210fedcba9876543210.html">안건</a></figure>`)),
    "개인 페이지 & 공유된 페이지/회의/image.png": new Uint8Array([1, 2, 3]),
    "개인 페이지 & 공유된 페이지/회의/안건 fedcba9876543210fedcba9876543210.html": strToU8(page("안건", "📌", "<p>안건 본문</p>")),
    "개인 페이지 & 공유된 페이지/회의/메모 11112222333344445555666677778888.html": strToU8(page("메모", null, "<p>메모 본문</p>")),
  });
  return new File([zip as BlobPart], "export.zip", { type: "application/zip" });
}

describe("importNotion", () => {
  beforeEach(() => {
    docs.clear();
    nextId = 500;
    vi.clearAllMocks();
  });

  it("최상위 페이지 내용은 대상 문서에, 하위 페이지는 그 아래 새 문서로 만들고 페이지 블록으로 잇는다", async () => {
    const result = await importNotion(exportZip(), { spaceId: 1, documentId: 10, title: "제목 없음", icon: null, applyTitle: true });

    expect(result).toEqual({ pages: 3, files: 1, skipped: [] });
    expect(documentsApi.renameDocument).toHaveBeenCalledWith(10, "회의");
    expect(documentsApi.changeDocumentIcon).toHaveBeenCalledWith(10, "📝");
    // 본문 링크가 있는 안건이 먼저, 링크 없는 메모가 뒤
    expect(vi.mocked(documentsApi.createDocument).mock.calls.map((call) => [call[1], call[2]])).toEqual([[10, "안건"], [10, "메모"]]);
    expect(blocksOf(10).map((b) => b.type)).toEqual(["paragraph", "image", "page", "page"]);
    expect(blocksOf(10)[1].props.url).toBe("/api/attachments/image.png/download");
    expect(blocksOf(10).slice(2).map((b) => b.props.documentId)).toEqual([500, 501]);
    expect(blocksOf(500)[0].content?.[0].text).toBe("안건 본문");
    expect(blocksOf(501)[0].content?.[0].text).toBe("메모 본문");
  });

  it("본문이 있는 페이지에는 뒤에 이어 붙이고 수정 이력에 이전 본문을 남기며, 제목이 있으면 바꾸지 않는다", async () => {
    const doc = new Y.Doc();
    docs.set(10, doc);
    blocksToYXmlFragment(reader, [{ type: "paragraph", content: "원래 본문" }] as never, doc.getXmlFragment("document-store"));

    await importNotion(exportZip(), { spaceId: 1, documentId: 10, title: "내 페이지", icon: "🏠", applyTitle: true });

    expect(blocksOf(10)[0].content?.[0].text).toBe("원래 본문");
    expect(blocksOf(10)[1].content?.[0].text).toBe("회의 본문");
    expect(historyApi.saveHistoryCheckpoint).toHaveBeenCalledWith(10, expect.any(String));
    expect(documentsApi.renameDocument).not.toHaveBeenCalled();
    expect(documentsApi.changeDocumentIcon).not.toHaveBeenCalledWith(10, expect.anything());
  });

  it("노션 HTML이 없는 파일이면 알린다", async () => {
    const zip = zipSync({ "readme.txt": strToU8("x") });
    await expect(importNotion(new File([zip as BlobPart], "x.zip"), { spaceId: 1, documentId: 10, title: "a", icon: null, applyTitle: true }))
      .rejects.toThrow("노션에서 HTML로 내보낸 파일");
  });
});
