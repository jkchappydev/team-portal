import type { CSSProperties } from "react";
import type { Cell, Worksheet } from "exceljs";

// 미리보기 표의 한 칸 (병합된 칸은 첫 칸에만 span을 두고 나머지는 목록에서 뺌)
export interface GridCell {
  key: string;
  text: string;
  colSpan: number;
  rowSpan: number;
  style: CSSProperties;
}

export interface GridRow {
  key: number;
  // 행 높이(px), 없으면 기본 높이
  height?: number;
  cells: GridCell[];
}

export interface SheetGrid {
  name: string;
  // 열 너비(px)
  columnWidths: number[];
  rows: GridRow[];
}

// 너무 큰 시트는 화면이 멈추지 않도록 앞부분만 표시
export const MAX_ROWS = 500;
export const MAX_COLUMNS = 60;

// 엑셀 열 너비(글자 수)와 행 높이(pt)를 화면 px로 환산
const DEFAULT_COLUMN_WIDTH = 9;
const columnPx = (width: number | undefined) => Math.round((width ?? DEFAULT_COLUMN_WIDTH) * 7 + 5);
const rowPx = (height: number | undefined) => (height ? Math.round(height * 4 / 3) : undefined);

// "B3" → { row: 3, col: 2 }
function parseAddress(address: string): { row: number; col: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(address.replace(/\$/g, ""));
  if (!match) return { row: 0, col: 0 };
  const col = match[1].split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return { row: Number(match[2]), col };
}

// 엑셀 색(ARGB, 예: FFFF0000)을 CSS 색으로 (테마 색 등 ARGB가 없으면 무시)
function toCssColor(argb: string | undefined): string | undefined {
  if (!argb || argb.length !== 8) return undefined;
  return `#${argb.slice(2)}`;
}

// 글꼴·채우기·정렬·테두리 중 미리보기에 필요한 것만 옮김
function cellStyle(cell: Cell): CSSProperties {
  const style: CSSProperties = {};
  const font = cell.font;
  if (font?.bold) style.fontWeight = 700;
  if (font?.italic) style.fontStyle = "italic";
  if (font?.underline) style.textDecoration = "underline";
  if (font?.size) style.fontSize = `${font.size}pt`;
  const color = toCssColor(font?.color?.argb);
  if (color) style.color = color;
  const fill = cell.fill;
  if (fill?.type === "pattern" && fill.pattern === "solid") {
    const background = toCssColor(fill.fgColor?.argb);
    if (background) style.background = background;
  }
  const alignment = cell.alignment;
  if (alignment?.horizontal && ["left", "center", "right", "justify"].includes(alignment.horizontal)) {
    style.textAlign = alignment.horizontal as CSSProperties["textAlign"];
  }
  if (alignment?.vertical === "top") style.verticalAlign = "top";
  else if (alignment?.vertical === "bottom") style.verticalAlign = "bottom";
  else style.verticalAlign = "middle";
  if (alignment?.wrapText) style.whiteSpace = "pre-wrap";
  const border = cell.border;
  const side = (b: { style?: string } | undefined) => (b?.style ? "1px solid #555" : undefined);
  if (border) {
    style.borderTop = side(border.top);
    style.borderRight = side(border.right);
    style.borderBottom = side(border.bottom);
    style.borderLeft = side(border.left);
  }
  return style;
}

// 워크시트를 미리보기용 표 모델로 변환 (병합 셀은 rowSpan/colSpan으로 표현)
export function buildSheetGrid(worksheet: Worksheet): SheetGrid {
  const rowCount = Math.min(worksheet.rowCount, MAX_ROWS);
  const columnCount = Math.min(Math.max(worksheet.columnCount, 1), MAX_COLUMNS);

  // 병합 범위의 첫 칸에는 span, 나머지 칸은 건너뛰기 표시
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  const covered = new Set<string>();
  for (const range of worksheet.model.merges ?? []) {
    const [startText, endText] = range.split(":");
    const start = parseAddress(startText);
    const end = parseAddress(endText ?? startText);
    spans.set(`${start.row}:${start.col}`, {
      rowSpan: end.row - start.row + 1,
      colSpan: end.col - start.col + 1,
    });
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        if (r !== start.row || c !== start.col) covered.add(`${r}:${c}`);
      }
    }
  }

  const columnWidths = Array.from({ length: columnCount }, (_, i) => columnPx(worksheet.getColumn(i + 1).width));
  const rows: GridRow[] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: GridCell[] = [];
    for (let c = 1; c <= columnCount; c++) {
      const key = `${r}:${c}`;
      if (covered.has(key)) continue;
      const cell = row.getCell(c);
      const span = spans.get(key);
      cells.push({
        key,
        text: cellText(cell),
        colSpan: Math.min(span?.colSpan ?? 1, columnCount - c + 1),
        rowSpan: Math.min(span?.rowSpan ?? 1, rowCount - r + 1),
        style: cellStyle(cell),
      });
    }
    rows.push({ key: r, height: rowPx(row.height), cells });
  }
  return { name: worksheet.name, columnWidths, rows };
}

// 칸에 보일 글자: 서식 섞인 글자·수식 결과·링크처럼 값이 객체인 칸은 안쪽 글자를 꺼냄
// (ExcelJS의 cell.text는 이런 칸을 "[object Object]"로 바꿔 버림)
export function cellText(cell: Pick<Cell, "value" | "text">): string {
  const value = cell.value;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) return valueText(value);
  return cell.text ?? "";
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "object") return String(value);
  const object = value as Record<string, unknown>;
  // 글자 일부에 서식이 다른 칸
  if (Array.isArray(object.richText)) {
    return object.richText.map((part: { text?: unknown }) => (typeof part.text === "string" ? part.text : "")).join("");
  }
  // 수식 칸은 계산 결과 (결과가 다시 서식 글자일 수 있음)
  if ("formula" in object || "sharedFormula" in object || "result" in object) return valueText(object.result);
  // 링크 칸은 보이는 글자
  if ("text" in object) return valueText(object.text);
  // #N/A 같은 오류 값
  if ("error" in object) return String(object.error);
  return "";
}
