import { describe, expect, it } from "vitest";
import { pickDropTarget } from "./blockDrop";
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

  it("놓을 블록이 없으면 null", () => {
    expect(pickDropTarget([], 10)).toBeNull();
  });
});
