import { describe, expect, it } from "vitest";
import { listNumbers, toCell, toRuns } from "./blockModel";
import type { ExportBlock } from "./blockModel";

describe("toRuns", () => {
  it("글자 모양과 링크 주소를 조각으로 옮긴다", () => {
    const runs = toRuns([
      { type: "text", text: "굵게", styles: { bold: true, textColor: "red" } },
      { type: "link", href: "https://example.com", content: [{ type: "text", text: "링크" }] },
    ]);

    expect(runs[0]).toMatchObject({ text: "굵게", bold: true, textColor: "red", href: undefined });
    // 링크는 밑줄을 긋고 주소를 붙임
    expect(runs[1]).toMatchObject({ text: "링크", underline: true, href: "https://example.com" });
  });

  it("내용이 없으면 빈 목록이다", () => {
    expect(toRuns(undefined)).toEqual([]);
  });
});

describe("toCell", () => {
  it("예전 형식 칸(인라인 배열)도 칸 객체로 맞춘다", () => {
    expect(toCell([{ type: "text", text: "가" }])).toEqual({
      type: "tableCell",
      props: {},
      content: [{ type: "text", text: "가" }],
    });
  });
});

describe("listNumbers", () => {
  it("이어진 번호 목록은 1부터 세고 다른 블록이 끼면 다시 센다", () => {
    const blocks: ExportBlock[] = [
      { type: "numberedListItem" },
      { type: "numberedListItem" },
      { type: "paragraph" },
      { type: "numberedListItem", props: { start: 5 } },
      { type: "numberedListItem" },
    ];

    expect([...listNumbers(blocks).entries()]).toEqual([[0, 1], [1, 2], [3, 5], [4, 6]]);
  });
});
