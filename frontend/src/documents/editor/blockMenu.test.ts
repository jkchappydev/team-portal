import { describe, expect, it } from "vitest";
import { cellsColor, clearCells, colorCells, colorTableCells, colorsFor, tableColor, withoutIds } from "./blockMenu";
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

describe("고른 칸 처리", () => {
  const grid = (): TableContent => ({
    type: "tableContent",
    rows: [
      { cells: [{ type: "tableCell", props: {}, content: [{ type: "text", text: "가" }] }, [{ type: "text", text: "나" }]] },
      { cells: [{ type: "tableCell", props: {}, content: [{ type: "text", text: "다" }] }, [{ type: "text", text: "라" }]] },
    ],
  });
  const firstRow = [{ row: 0, col: 0 }, { row: 0, col: 1 }];

  it("고른 칸에만 색을 칠한다", () => {
    const colored = colorCells(grid(), firstRow, "backgroundColor", "yellow");
    expect(cellsColor(colored, firstRow, "backgroundColor")).toBe("yellow");
    expect(cellsColor(colored, [{ row: 1, col: 0 }], "backgroundColor")).toBe("default");
  });

  it("고른 칸들의 색이 서로 다르면 현재 색이 없다", () => {
    const colored = colorCells(grid(), [{ row: 0, col: 0 }], "textColor", "red");
    expect(cellsColor(colored, firstRow, "textColor")).toBeUndefined();
  });

  it("고른 칸의 글만 비우고 칸 색은 남긴다", () => {
    const cleared = clearCells(colorCells(grid(), firstRow, "textColor", "red"), firstRow);
    expect(cleared.rows[0].cells).toEqual([
      { type: "tableCell", props: { textColor: "red" }, content: [] },
      { type: "tableCell", props: { textColor: "red" }, content: [] },
    ]);
    expect(cleared.rows[1].cells[0]).toEqual({ type: "tableCell", props: {}, content: [{ type: "text", text: "다" }] });
  });
});

describe("colorsFor", () => {
  it("글자색에는 기본 다음에 검은색이 있고 배경색에는 없다", () => {
    expect(colorsFor("textColor").map((c) => c.value).slice(0, 3)).toEqual(["default", "black", "gray"]);
    expect(colorsFor("backgroundColor").map((c) => c.value)).not.toContain("black");
  });
});
