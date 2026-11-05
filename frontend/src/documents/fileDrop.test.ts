import { afterEach, describe, expect, it } from "vitest";
import { blockTypeForFile, dropTargetAt, insertDroppedFiles } from "./fileDrop";
import type { DropEditor } from "./fileDrop";

interface FakeBlock {
  id: string;
  type: string;
  content?: unknown;
  props?: Record<string, unknown>;
}

// 최상위 블록만 다루는 간단한 가짜 편집기
function fakeEditor(initial: FakeBlock[]) {
  const blocks = [...initial];
  let seq = 0;
  const editor: DropEditor & { blocks: FakeBlock[] } = {
    blocks,
    get document() {
      return blocks;
    },
    getBlock: (id) => blocks.find((b) => b.id === id),
    insertBlocks: (newBlocks, reference, placement) => {
      const index = blocks.findIndex((b) => b.id === reference.id);
      const created = newBlocks.map((b) => ({ ...b, id: `new-${++seq}` }));
      blocks.splice(placement === "before" ? index : index + 1, 0, ...created);
      return created;
    },
    updateBlock: (block, update) => {
      const id = typeof block === "string" ? block : block.id;
      const target = blocks.find((b) => b.id === id)!;
      const { props, ...rest } = update as { props?: Record<string, unknown> };
      Object.assign(target, rest, { content: undefined });
      target.props = { ...target.props, ...props };
    },
    removeBlocks: (ids) => {
      ids.forEach((id) => blocks.splice(blocks.findIndex((b) => b.id === id), 1));
    },
  };
  return editor;
}

const file = (name: string, type: string) => new File(["x"], name, { type });
const names = (blocks: FakeBlock[]) => blocks.map((b) => (b.props?.name as string | undefined) ?? b.id);

describe("blockTypeForFile", () => {
  it("파일 종류에 맞는 블록을 고른다", () => {
    expect(blockTypeForFile(file("a.png", "image/png"))).toBe("image");
    expect(blockTypeForFile(file("a.svg", "image/svg+xml"))).toBe("file");
    expect(blockTypeForFile(file("a.mp4", "video/mp4"))).toBe("video");
    expect(blockTypeForFile(file("a.mp3", "audio/mpeg"))).toBe("audio");
    expect(blockTypeForFile(file("a.pdf", "application/pdf"))).toBe("file");
  });
});

describe("insertDroppedFiles", () => {
  it("여러 파일을 떨어뜨린 블록 뒤에 선택한 순서대로 넣고 업로드 URL을 채운다", async () => {
    const editor = fakeEditor([
      { id: "a", type: "paragraph", content: [{ text: "첫 줄" }] },
      { id: "b", type: "paragraph", content: [{ text: "둘째 줄" }] },
    ]);
    const files = [file("1.pdf", "application/pdf"), file("2.png", "image/png"), file("3.txt", "text/plain")];

    const failed = await insertDroppedFiles(editor, files, { blockId: "a", placement: "after" },
      (f) => Promise.resolve(`/files/${f.name}`));

    expect(failed).toEqual([]);
    expect(names(editor.blocks)).toEqual(["a", "1.pdf", "2.png", "3.txt", "b"]);
    expect(editor.blocks[2]).toMatchObject({ type: "image", props: { url: "/files/2.png" } });
  });

  it("블록 위쪽 절반에 떨어뜨리면 그 블록 앞에 넣는다", async () => {
    const editor = fakeEditor([{ id: "a", type: "paragraph", content: [{ text: "본문" }] }]);

    await insertDroppedFiles(editor, [file("1.pdf", "application/pdf"), file("2.pdf", "application/pdf")],
      { blockId: "a", placement: "before" }, () => Promise.resolve("/u"));

    expect(names(editor.blocks)).toEqual(["1.pdf", "2.pdf", "a"]);
  });

  it("빈 문단에 떨어뜨리면 그 자리를 첫 파일로 바꾼다", async () => {
    const editor = fakeEditor([{ id: "a", type: "paragraph", content: [] }]);

    await insertDroppedFiles(editor, [file("1.pdf", "application/pdf"), file("2.pdf", "application/pdf")],
      { blockId: "a", placement: "after" }, () => Promise.resolve("/u"));

    expect(editor.blocks.map((b) => [b.id, b.props?.name])).toEqual([["a", "1.pdf"], ["new-1", "2.pdf"]]);
  });

  it("블록 밖(본문 아래 빈 곳)에 떨어뜨리면 문서 맨 끝에 넣는다", async () => {
    const editor = fakeEditor([
      { id: "a", type: "paragraph", content: [{ text: "1" }] },
      { id: "b", type: "paragraph", content: [{ text: "2" }] },
    ]);

    await insertDroppedFiles(editor, [file("1.pdf", "application/pdf")], { blockId: null, placement: "after" },
      () => Promise.resolve("/u"));

    expect(names(editor.blocks)).toEqual(["a", "b", "1.pdf"]);
  });

  it("업로드에 실패한 파일은 블록을 지우고 이름을 돌려준다", async () => {
    const editor = fakeEditor([{ id: "a", type: "paragraph", content: [{ text: "본문" }] }]);

    const failed = await insertDroppedFiles(editor,
      [file("ok.pdf", "application/pdf"), file("big.zip", "application/zip")],
      { blockId: "a", placement: "after" },
      (f) => (f.name === "big.zip" ? Promise.reject(new Error("too large")) : Promise.resolve("/u")));

    expect(failed).toEqual(["big.zip"]);
    expect(names(editor.blocks)).toEqual(["a", "ok.pdf"]);
  });
});

describe("dropTargetAt", () => {
  const original = document.elementFromPoint;
  afterEach(() => {
    document.elementFromPoint = original;
    document.body.innerHTML = "";
  });

  it("마우스 아래 블록의 위·아래 절반으로 놓을 위치를 정한다", () => {
    document.body.innerHTML = '<div id="root"><div class="bn-block-outer" data-id="blk"><p id="text">본문</p></div></div>';
    const root = document.getElementById("root")!;
    const block = root.querySelector<HTMLElement>(".bn-block-outer")!;
    block.getBoundingClientRect = () => ({ top: 100, bottom: 140 }) as DOMRect;
    document.elementFromPoint = () => document.getElementById("text");

    expect(dropTargetAt(root, 0, 110)).toEqual({ blockId: "blk", placement: "before" });
    expect(dropTargetAt(root, 0, 130)).toEqual({ blockId: "blk", placement: "after" });
  });

  it("블록이 아닌 곳이면 문서 끝으로 처리한다", () => {
    document.body.innerHTML = '<div id="root"><div id="empty"></div></div>';
    document.elementFromPoint = () => document.getElementById("empty");

    expect(dropTargetAt(document.getElementById("root")!, 0, 0)).toEqual({ blockId: null, placement: "after" });
  });
});
