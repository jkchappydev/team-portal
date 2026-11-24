import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { collectDropRows, moveBlocks, pickDropTarget, pickDropTargetAt } from "./blockDrop";
import { editorSchema } from "./schema";
import type { DropRow } from "./blockDrop";

function row(id: string, top: number, bottom: number, extra: Partial<DropRow> = {}): DropRow {
  return { id, parentId: null, top, bottom, blockBottom: bottom, hasChildren: false, container: false, ...extra };
}

describe("pickDropTarget", () => {
  // 0~30 a, 30~60 b (여러 줄 문단도 높이 기준)
  const flat = [row("a", 0, 30), row("b", 30, 90)];

  it("블록 위쪽 절반이면 앞, 아래쪽 절반이면 뒤에 놓는다", () => {
    expect(pickDropTarget(flat, 10)).toEqual({ blockId: "a", placement: "before" });
    expect(pickDropTarget(flat, 20)).toEqual({ blockId: "a", placement: "after" });
    // 여러 줄 문단은 글자 수가 아니라 높이 절반 기준
    expect(pickDropTarget(flat, 50)).toEqual({ blockId: "b", placement: "before" });
    expect(pickDropTarget(flat, 70)).toEqual({ blockId: "b", placement: "after" });
  });

  it("첫 블록 위나 마지막 블록 아래 바깥도 가장 가까운 자리로 잡는다", () => {
    expect(pickDropTarget(flat, -40)).toEqual({ blockId: "a", placement: "before" });
    expect(pickDropTarget(flat, 400)).toEqual({ blockId: "b", placement: "after" });
  });

  it("하위 블록이 펼쳐진 블록의 아래쪽 절반은 첫 하위 블록 앞이다", () => {
    const rows = [row("p", 0, 30, { blockBottom: 60, hasChildren: true }), row("c", 30, 60, { parentId: "p" })];
    expect(pickDropTarget(rows, 20)).toEqual({ blockId: "p", placement: "firstChild" });
  });

  it("콜아웃은 상자 위 여백에서 앞, 안쪽 줄은 그 줄 기준, 상자 아래 바깥은 콜아웃 뒤다", () => {
    const rows = [
      row("callout", 0, 100, { blockBottom: 100, hasChildren: true, container: true }),
      row("title", 10, 40, { parentId: "callout" }),
      row("body", 40, 80, { parentId: "callout" }),
      row("next", 110, 140),
    ];
    expect(pickDropTarget(rows, 5)).toEqual({ blockId: "callout", placement: "before" });
    // 첫 줄(제목) 위쪽 절반은 제목 앞 (안쪽 줄끼리 순서를 바꿔 제목을 바꿀 수 있음)
    expect(pickDropTarget(rows, 15)).toEqual({ blockId: "title", placement: "before" });
    expect(pickDropTarget(rows, 35)).toEqual({ blockId: "title", placement: "after" });
    expect(pickDropTarget(rows, 45)).toEqual({ blockId: "body", placement: "before" });
    // 상자 안 아래 여백은 마지막 줄 뒤 (상자 안)
    expect(pickDropTarget(rows, 90)).toEqual({ blockId: "body", placement: "after" });
    // 상자와 다음 블록 사이는 콜아웃 뒤
    expect(pickDropTarget(rows, 105)).toEqual({ blockId: "callout", placement: "after" });
  });

  it("펼친 빈 토글은 제목 아래쪽 절반과 안내 줄에 놓으면 하위로 넣는다", () => {
    // 제목 0~30, 안내 줄 30~60, 다음 블록 60~90
    const rows = [row("t", 0, 30, { blockBottom: 60, emptyToggle: true }), row("n", 60, 90)];
    expect(pickDropTarget(rows, 10)).toEqual({ blockId: "t", placement: "before" });
    expect(pickDropTarget(rows, 20)).toEqual({ blockId: "t", placement: "firstChild" });
    expect(pickDropTarget(rows, 50)).toEqual({ blockId: "t", placement: "firstChild" });
    expect(pickDropTarget(rows, 70)).toEqual({ blockId: "n", placement: "before" });
  });

  it("놓을 블록이 없으면 null", () => {
    expect(pickDropTarget([], 10)).toBeNull();
  });
});

describe("pickDropTargetAt", () => {
  // 0~300px 너비 줄: a(0~30), b(30~60)
  const wide = (id: string, top: number, bottom: number, extra: Partial<DropRow> = {}) =>
    row(id, top, bottom, { left: 0, right: 300, columnId: null, sideAllowed: true, ...extra });

  it("줄 안쪽 왼쪽·오른쪽 가장자리면 그 블록 옆, 가운데면 기존처럼 위아래", () => {
    const rows = [wide("a", 0, 30), wide("b", 30, 60)];
    expect(pickDropTargetAt(rows, 20, 40)).toEqual({ blockId: "b", placement: "left" });
    expect(pickDropTargetAt(rows, 290, 40)).toEqual({ blockId: "b", placement: "right" });
    expect(pickDropTargetAt(rows, 150, 40)).toEqual({ blockId: "b", placement: "before" });
  });

  it("손잡이처럼 줄 왼쪽 바깥에서 끌면 옆에 놓지 않는다", () => {
    expect(pickDropTargetAt([wide("a", 0, 30)], -20, 10)).toEqual({ blockId: "a", placement: "before" });
  });

  // 예전에는 줄 앞 120px까지 왼쪽 옆 놓기라, 손잡이에서 끌다 마우스가 조금만 들어와도 다단이 먼저 잡혔음
  it("왼쪽 옆 놓기는 줄 맨 앞 24px까지만, 그 오른쪽은 위아래로 놓는다", () => {
    const rows = [wide("a", 0, 30), wide("b", 30, 60)];
    expect(pickDropTargetAt(rows, 24, 40)).toEqual({ blockId: "b", placement: "left" });
    expect(pickDropTargetAt(rows, 40, 40)).toEqual({ blockId: "b", placement: "before" });
    expect(pickDropTargetAt(rows, 40, 50)).toEqual({ blockId: "b", placement: "after" });
  });

  it("옆에 놓을 수 없는 줄(목록 하위 등)이나 옆 놓기를 막으면 위아래로만 놓는다", () => {
    expect(pickDropTargetAt([wide("a", 0, 30, { sideAllowed: false })], 290, 10)).toEqual({ blockId: "a", placement: "before" });
    expect(pickDropTargetAt([wide("a", 0, 30)], 290, 10, false)).toEqual({ blockId: "a", placement: "before" });
  });

  it("열 안에서는 마우스가 있는 열의 줄만 대상으로 한다", () => {
    const rows = [
      wide("l1", 0, 30, { left: 0, right: 140, columnId: "L" }),
      wide("l2", 30, 60, { left: 0, right: 140, columnId: "L" }),
      wide("r1", 0, 30, { left: 160, right: 300, columnId: "R" }),
    ];
    expect(pickDropTargetAt(rows, 220, 50)).toEqual({ blockId: "r1", placement: "after" });
    expect(pickDropTargetAt(rows, 70, 50)).toEqual({ blockId: "l2", placement: "after" });
    expect(pickDropTargetAt(rows, 295, 10)).toEqual({ blockId: "r1", placement: "right" });
  });
});

describe("moveBlocks 옆에 놓기", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function mount(initialContent: any[]) {
    const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    return editor;
  }

  const shape = (blocks: any[]): any[] => blocks.map((b) => ({
    type: b.type,
    ...(Array.isArray(b.content) && b.content.length ? { text: b.content.map((c: any) => c.text).join("") } : {}),
    ...(b.type === "column" ? { width: b.props.width } : {}),
    ...(b.children.length ? { children: shape(b.children) } : {}),
  }));

  it("블록 오른쪽에 놓으면 두 블록을 열 묶음으로 감싼다", () => {
    const editor = mount([
      { id: "a", type: "paragraph", content: "가" },
      { id: "b", type: "paragraph", content: "나" },
      { id: "c", type: "paragraph", content: "다" },
    ]);
    moveBlocks(editor, ["c"], { blockId: "a", placement: "right" });
    expect(shape(editor.document)).toEqual([
      { type: "columnList", children: [
        { type: "column", width: 1, children: [{ type: "paragraph", text: "가" }] },
        { type: "column", width: 1, children: [{ type: "paragraph", text: "다" }] },
      ] },
      { type: "paragraph", text: "나" },
    ]);
    expect(editor.getBlock("c")).toBeDefined();
    editor.unmount();
  });

  it("열 안의 블록 왼쪽에 놓으면 그 열 앞에 새 열을 더한다", () => {
    const editor = mount([
      { type: "columnList", children: [
        { type: "column", props: { width: 1 }, children: [{ id: "a", type: "paragraph", content: "가" }] },
        { type: "column", props: { width: 2 }, children: [{ id: "b", type: "paragraph", content: "나" }] },
      ] },
      { id: "c", type: "paragraph", content: "다" },
    ]);
    moveBlocks(editor, ["c"], { blockId: "b", placement: "left" });
    expect(shape(editor.document)).toEqual([
      { type: "columnList", children: [
        { type: "column", width: 1, children: [{ type: "paragraph", text: "가" }] },
        { type: "column", width: 1.5, children: [{ type: "paragraph", text: "다" }] },
        { type: "column", width: 2, children: [{ type: "paragraph", text: "나" }] },
      ] },
    ]);
    editor.unmount();
  });

  it("두 열 중 한 열의 마지막 블록을 밖으로 빼면 열 묶음이 풀린다", () => {
    const editor = mount([
      { type: "columnList", children: [
        { type: "column", children: [{ id: "a", type: "paragraph", content: "가" }] },
        { type: "column", children: [{ id: "b", type: "paragraph", content: "나" }] },
      ] },
      { id: "c", type: "paragraph", content: "다" },
    ]);
    moveBlocks(editor, ["b"], { blockId: "c", placement: "after" });
    expect(shape(editor.document)).toEqual([
      { type: "paragraph", text: "가" },
      { type: "paragraph", text: "다" },
      { type: "paragraph", text: "나" },
    ]);
    editor.unmount();
  });
});

describe("collectDropRows 토글", () => {
  const originalRect = Element.prototype.getBoundingClientRect;
  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalRect;
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("토글 줄을 놓을 대상에 넣고, 펼친 빈 토글이면 하위로 넣을 수 있다고 표시한다", () => {
    // jsdom은 크기가 0이라 모든 요소를 높이 10으로 둠
    Element.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 10, left: 0, right: 100, width: 100, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    localStorage.setItem("toggle-open", "true");
    const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: [
      { id: "open", type: "toggleListItem", content: "빈 토글" },
      { id: "full", type: "toggleListItem", content: "토글", children: [{ id: "child", type: "paragraph", content: "안" }] },
      { id: "a", type: "paragraph", content: "가" },
    ] });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    const rows = collectDropRows(host, new Set(["a"]));
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("open")?.emptyToggle).toBe(true);
    expect(byId.get("full")?.emptyToggle).toBe(false);
    expect(byId.get("child")?.parentId).toBe("full");

    moveBlocks(editor, ["a"], { blockId: "open", placement: "firstChild" });
    expect(editor.getBlock("open")?.children.map((b) => b.id)).toEqual(["a"]);
    editor.unmount();
  });
});
