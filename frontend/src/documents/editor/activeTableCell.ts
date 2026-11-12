import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const ACTIVE_CELL_CLASS = "active-table-cell";
// 여러 칸 선택 범위의 칸과 바깥 가장자리 표시 (테두리는 index.css)
export const RANGE_CELL_CLASS = "cell-range";
export type RangeEdge = "top" | "right" | "bottom" | "left";

// 커서(글자 선택 포함)가 들어 있는 표 칸의 위치, 표 밖이거나 여러 칸을 고른 경우(칸 선택)는 undefined
export function activeCellRange(state: EditorState): { from: number; to: number } | undefined {
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return undefined;
  const { $from, $to } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const role = $from.node(depth).type.spec.tableRole;
    if (role !== "cell" && role !== "header_cell") continue;
    const from = $from.before(depth);
    const to = $from.after(depth);
    // 선택이 칸 밖까지 이어지면 강조하지 않음
    return $to.pos <= to ? { from, to } : undefined;
  }
  return undefined;
}

// 칸 선택(드래그로 여러 칸 선택)의 각 칸 위치와 선택 범위 바깥쪽에 닿는 변
export function selectedCellEdges(state: EditorState): { from: number; to: number; edges: RangeEdge[] }[] {
  const { selection } = state;
  if (!(selection instanceof CellSelection)) return [];
  const table = selection.$anchorCell.node(-1);
  const tableStart = selection.$anchorCell.start(-1);
  const map = TableMap.get(table);
  const rect = map.rectBetween(selection.$anchorCell.pos - tableStart, selection.$headCell.pos - tableStart);
  return map.cellsInRect(rect).map((cellPos) => {
    const cell = map.findCell(cellPos);
    const edges: RangeEdge[] = [];
    if (cell.top === rect.top) edges.push("top");
    if (cell.right === rect.right) edges.push("right");
    if (cell.bottom === rect.bottom) edges.push("bottom");
    if (cell.left === rect.left) edges.push("left");
    const from = tableStart + cellPos;
    return { from, to: from + table.nodeAt(cellPos)!.nodeSize, edges };
  });
}

// 노션처럼 지금 입력 중인 표 칸을 테두리로 강조하고, 여러 칸 선택은 범위 바깥에 테두리를 그림
// (모양은 index.css의 .active-table-cell·.cell-range, 편집기에 초점이 있을 때만 보임)
export const activeTableCellExtension = createExtension({
  key: "activeTableCell",
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("activeTableCell"),
      props: {
        decorations(state) {
          const range = activeCellRange(state);
          if (range) {
            return DecorationSet.create(state.doc, [Decoration.node(range.from, range.to, { class: ACTIVE_CELL_CLASS })]);
          }
          const cells = selectedCellEdges(state);
          if (cells.length === 0) return null;
          return DecorationSet.create(state.doc, cells.map(({ from, to, edges }) =>
            Decoration.node(from, to, {
              class: [RANGE_CELL_CLASS, ...edges.map((edge) => `${RANGE_CELL_CLASS}-${edge}`)].join(" "),
            })));
        },
      },
    }),
  ],
});
