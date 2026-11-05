import { describe, expect, it } from "vitest";
import { colorTableCells, tableColor, withoutIds } from "./blockMenu";
import type { TableContent } from "./blockMenu";

const table = (): TableContent => ({
  type: "tableContent",
  headerRows: 1,
  rows: [
    { cells: [{ type: "tableCell", props: { colspan: 1 }, content: [] }, [{ type: "text", text: "예전 칸" }]] },
  ],
});

describe("colorTableCells", () => {
  it("표 전체 칸에 배경색을 칠하고 칸의 다른 속성과 표 설정은 유지한다", () => {
    const colored = colorTableCells(table(), "backgroundColor", "blue");

    expect(colored.headerRows).toBe(1);
    expect(colored.rows[0].cells).toEqual([
      { type: "tableCell", props: { colspan: 1, backgroundColor: "blue" }, content: [] },
      // 예전 형식 칸도 칸 객체로 바꿔서 색 적용
      { type: "tableCell", props: { backgroundColor: "blue" }, content: [{ type: "text", text: "예전 칸" }] },
    ]);
  });

  it("첫 칸의 색을 표의 현재 색으로 본다", () => {
    expect(tableColor(table(), "textColor")).toBe("default");
    expect(tableColor(colorTableCells(table(), "textColor", "red"), "textColor")).toBe("red");
  });
});

describe("withoutIds", () => {
  it("블록과 하위 블록의 id를 모두 지운다", () => {
    const copy = withoutIds({
      id: "a",
      type: "bulletListItem",
      props: {},
      content: [],
      children: [{ id: "b", type: "paragraph", children: [] }],
    });

    expect(copy).toEqual({
      type: "bulletListItem",
      props: {},
      content: [],
      children: [{ type: "paragraph", children: [] }],
    });
  });
});
