import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildSheetGrid, cellText } from "./xlsxGrid";

// 저장했다 다시 읽어 실제 파일을 여는 것과 같은 상태로 만듦
async function roundTrip(build: (sheet: ExcelJS.Worksheet) => void) {
  const workbook = new ExcelJS.Workbook();
  build(workbook.addWorksheet("품의서"));
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  return loaded.worksheets[0];
}

describe("buildSheetGrid", () => {
  it("값과 시트 이름을 표로 옮긴다", async () => {
    const sheet = await roundTrip((s) => {
      s.getCell("A1").value = "항목";
      s.getCell("B1").value = "금액";
      s.getCell("A2").value = "서버";
      s.getCell("B2").value = 1200;
    });

    const grid = buildSheetGrid(sheet);

    expect(grid.name).toBe("품의서");
    expect(grid.rows.map((r) => r.cells.map((c) => c.text))).toEqual([["항목", "금액"], ["서버", "1200"]]);
  });

  it("병합 셀은 첫 칸에 rowSpan·colSpan을 주고 가려진 칸은 뺀다", async () => {
    const sheet = await roundTrip((s) => {
      s.getCell("A1").value = "품 의 서";
      s.getCell("C3").value = "끝";
      s.mergeCells("A1:B2");
    });

    const grid = buildSheetGrid(sheet);

    expect(grid.rows[0].cells[0]).toMatchObject({ text: "품 의 서", colSpan: 2, rowSpan: 2 });
    // 1행은 A(병합 시작)·C, 2행은 C만 남음
    expect(grid.rows[0].cells.map((c) => c.key)).toEqual(["1:1", "1:3"]);
    expect(grid.rows[1].cells.map((c) => c.key)).toEqual(["2:3"]);
  });

  it("굵은 글씨·배경색·가운데 정렬·테두리를 스타일로 옮긴다", async () => {
    const sheet = await roundTrip((s) => {
      const cell = s.getCell("A1");
      cell.value = "제목";
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
      cell.alignment = { horizontal: "center" };
      cell.border = { bottom: { style: "thin" } };
    });

    const style = buildSheetGrid(sheet).rows[0].cells[0].style;

    expect(style).toMatchObject({ fontWeight: 700, background: "#FFFF00", textAlign: "center", borderBottom: "1px solid #555" });
  });

  it("서식 섞인 글자·수식 결과·링크 칸은 [object Object] 대신 글자를 보여준다", async () => {
    const sheet = await roundTrip((s) => {
      s.getCell("A1").value = { richText: [{ text: "[ " }, { font: { bold: true }, text: "구매 내역" }, { text: " ]" }] };
      s.getCell("B1").value = { formula: "1+1", result: 2 };
      s.getCell("C1").value = { text: "사이트", hyperlink: "https://example.com" };
    });

    const texts = buildSheetGrid(sheet).rows[0].cells.map((c) => c.text);

    expect(texts).toEqual(["[ 구매 내역 ]", "2", "사이트"]);
    expect(texts.join("")).not.toContain("[object Object]");
  });

  it("수식 결과가 서식 글자이거나 오류여도 글자로 바꾼다", () => {
    expect(cellText({ value: { formula: "A1", result: { richText: [{ text: "합계" }] } }, text: "[object Object]" } as never)).toBe("합계");
    expect(cellText({ value: { formula: "A1", result: { error: "#N/A" } }, text: "[object Object]" } as never)).toBe("#N/A");
    expect(cellText({ value: null, text: "" } as never)).toBe("");
  });
});
