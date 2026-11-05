// 노션식 블록 메뉴(⠿)에서 쓰는 색 목록과 블록 변환 도우미

// BlockNote 기본 색 이름과 메뉴에 보일 한국어 이름
export const BLOCK_COLORS = [
  { value: "default", label: "기본" },
  { value: "gray", label: "회색" },
  { value: "brown", label: "갈색" },
  { value: "orange", label: "주황색" },
  { value: "yellow", label: "노란색" },
  { value: "green", label: "초록색" },
  { value: "blue", label: "파란색" },
  { value: "purple", label: "보라색" },
  { value: "pink", label: "분홍색" },
  { value: "red", label: "빨간색" },
] as const;

export type ColorKind = "textColor" | "backgroundColor";

interface TableCellObject {
  type: "tableCell";
  props: Record<string, unknown>;
  content: unknown[];
}

// 예전 형식(칸 = 인라인 내용 배열)도 칸 객체로 맞춤
type TableCell = TableCellObject | unknown[];

export interface TableContent {
  type: "tableContent";
  rows: { cells: TableCell[] }[];
  [key: string]: unknown;
}

function toCellObject(cell: TableCell): TableCellObject {
  if (Array.isArray(cell)) return { type: "tableCell", props: {}, content: cell };
  return cell;
}

// 표 전체 칸에 같은 글자색 또는 배경색 적용 (표는 칸 단위로만 색을 저장)
export function colorTableCells(content: TableContent, kind: ColorKind, color: string): TableContent {
  return {
    ...content,
    rows: content.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        const object = toCellObject(cell);
        return { ...object, props: { ...object.props, [kind]: color } };
      }),
    })),
  };
}

// 표의 첫 칸 색을 표 전체 색으로 간주 (메뉴에 현재 색 표시용)
export function tableColor(content: TableContent, kind: ColorKind): string {
  const first = content.rows[0]?.cells[0];
  if (!first || Array.isArray(first)) return "default";
  return (first.props[kind] as string | undefined) ?? "default";
}

interface CopyableBlock {
  id?: string;
  type: string;
  props?: unknown;
  content?: unknown;
  children?: CopyableBlock[];
}

// 복제용으로 블록과 하위 블록의 id를 지움 (같은 id가 두 번 들어가지 않도록)
export function withoutIds<T extends CopyableBlock>(block: T): Omit<T, "id"> {
  // id는 버리고 나머지만 복사
  const { id: _omit, children, ...rest } = block;
  void _omit;
  return { ...rest, children: children?.map(withoutIds) } as Omit<T, "id">;
}
