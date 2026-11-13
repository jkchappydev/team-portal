import { describe, expect, it } from "vitest";
import { pickMarqueeBlocks } from "./blockMarquee";
import type { MarqueeBlock } from "./blockMarquee";

const rect = (top: number, bottom: number) => ({ left: 100, right: 600, top, bottom });
const block = (id: string, top: number, bottom: number, children: MarqueeBlock[] = []): MarqueeBlock => ({
  id, rect: rect(top, bottom), childrenTop: children.length > 0 ? children[0].rect.top : undefined, children,
});

// 0~30 a, 40~140 콜아웃{50~80 제목, 80~110 본문}, 150~180 b
const doc = [
  block("a", 0, 30),
  block("callout", 40, 140, [block("title", 50, 80), block("body", 80, 110)]),
  block("b", 150, 180),
];

describe("끌어서 여러 블록 고르기", () => {
  it("사각형에 걸린 바깥 블록을 고른다 (콜아웃은 통째로)", () => {
    expect(pickMarqueeBlocks(doc, { left: 50, right: 300, top: 10, bottom: 160 })).toEqual(["a", "callout", "b"]);
  });

  it("블록 글 영역에 닿지 않으면 고르지 않는다 (왼쪽 여백에서만 끈 경우)", () => {
    expect(pickMarqueeBlocks(doc, { left: 20, right: 90, top: 10, bottom: 160 })).toEqual([]);
  });

  it("콜아웃 안 줄 영역에서만 끌면 그 안의 줄을 고른다", () => {
    expect(pickMarqueeBlocks(doc, { left: 50, right: 300, top: 60, bottom: 100 })).toEqual(["title", "body"]);
  });

  it("콜아웃 위 끝을 넘어 끌면 콜아웃 통째로 고른다", () => {
    expect(pickMarqueeBlocks(doc, { left: 50, right: 300, top: 35, bottom: 100 })).toEqual(["callout"]);
  });
});
