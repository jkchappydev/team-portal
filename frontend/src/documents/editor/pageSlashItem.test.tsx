import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { createDocument } from "../../api/documents";
import { pageSlashItem } from "./pageSlashItem";
import type { PageEditor } from "./pageCommand";

vi.mock("../../api/documents", () => ({ createDocument: vi.fn() }));

function fakeEditor(): PageEditor & { getTextCursorPosition: () => { block: { id: string; content: unknown[] } } } {
  return {
    getBlock: (id: string) => (id === "cur" ? { id } : undefined),
    updateBlock: vi.fn(),
    insertBlocks: vi.fn(),
    document: [{ id: "cur" }],
    getTextCursorPosition: () => ({ block: { id: "cur", content: [] } }),
  };
}

describe("pageSlashItem", () => {
  afterEach(() => vi.resetAllMocks());

  it("/페이지는 지금 문서 아래에 새 페이지를 만들고 슬래시를 친 빈 줄을 그 페이지 블록으로 바꾼다", async () => {
    vi.mocked(createDocument).mockResolvedValue({ id: 77 } as Awaited<ReturnType<typeof createDocument>>);
    const editor = fakeEditor();
    const onCreated = vi.fn();
    const item = pageSlashItem({ editor, spaceId: 3, documentId: 42, onCreated, onError: vi.fn() });

    expect(item.title).toBe("페이지");
    expect(item.aliases).toEqual(expect.arrayContaining(["페이지", "page", "문서"]));
    item.onItemClick();

    await vi.waitFor(() => expect(editor.updateBlock).toHaveBeenCalledWith(
      { id: "cur", content: [] }, { type: "page", props: { documentId: 77 } }));
    expect(createDocument).toHaveBeenCalledWith(3, 42);
    expect(onCreated).toHaveBeenCalled();
  });

  it("만들지 못하면 서버 안내 문구(없으면 기본 문구)를 알린다", async () => {
    vi.mocked(createDocument).mockRejectedValueOnce(new ApiError("FORBIDDEN", "권한이 없습니다.", 403));
    const onError = vi.fn();
    pageSlashItem({ editor: fakeEditor(), spaceId: 3, documentId: 42, onCreated: vi.fn(), onError }).onItemClick();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("권한이 없습니다."));

    vi.mocked(createDocument).mockRejectedValueOnce(new Error("network"));
    pageSlashItem({ editor: fakeEditor(), spaceId: 3, documentId: 42, onCreated: vi.fn(), onError }).onItemClick();
    await vi.waitFor(() => expect(onError).toHaveBeenLastCalledWith("페이지를 만들지 못했습니다."));
  });
});
