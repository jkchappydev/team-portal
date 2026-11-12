import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { activeCellRange, selectedCellEdges } from "./activeTableCell";
import { editorSchema } from "./schema";

function setup() {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { type: "paragraph", content: "문단" },
      { type: "table", content: { type: "tableContent", rows: [{ cells: ["가", "나"] }, { cells: ["다", "라"] }] } },
    ],
  });
  const textPos = (text: string) => {
    let found = -1;
    editor.prosemirrorState.doc.descendants((node, pos) => {
      if (found < 0 && node.isText && node.text === text) found = pos;
    });
    return found;
  };
  const select = (from: number, to = from) => {
    const state = editor.prosemirrorState;
    editor.prosemirrorView!.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
    return editor.prosemirrorState;
  };
  // 글자를 담은 칸의 위치
  const cellPos = (text: string) => editor.prosemirrorState.doc.resolve(textPos(text)).before(-1);
  const selectCells = (anchor: string, head: string) => {
    const state = editor.prosemirrorState;
    editor.prosemirrorView!.dispatch(state.tr.setSelection(CellSelection.create(state.doc, cellPos(anchor), cellPos(head))));
    return editor.prosemirrorState;
  };
  return { editor, textPos, select, selectCells };
}

describe("activeCellRange", () => {
  it("커서가 들어 있는 표 칸 위치를 돌려준다", () => {
    const { textPos, select } = setup();
    const state = select(textPos("나") + 1);
    const range = activeCellRange(state)!;
    expect(state.doc.nodeAt(range.from)?.textContent).toBe("나");
  });

  it("표 밖이거나 선택이 여러 칸에 걸치면 강조하지 않는다", () => {
    const { textPos, select } = setup();
    expect(activeCellRange(select(textPos("문단") + 1))).toBeUndefined();
    expect(activeCellRange(select(textPos("가"), textPos("라") + 1))).toBeUndefined();
  });
});

describe("selectedCellEdges", () => {
  const edgesOf = (state: Parameters<typeof selectedCellEdges>[0]) =>
    selectedCellEdges(state).map(({ from, edges }) => [state.doc.nodeAt(from)?.textContent, edges.join(",")]);

  it("여러 칸 선택은 범위 바깥쪽에 닿는 변만 표시한다", () => {
    const { selectCells } = setup();
    expect(edgesOf(selectCells("가", "라"))).toEqual([
      ["가", "top,left"], ["나", "top,right"], ["다", "bottom,left"], ["라", "right,bottom"],
    ]);
    expect(edgesOf(selectCells("가", "나"))).toEqual([["가", "top,bottom,left"], ["나", "top,right,bottom"]]);
  });

  it("칸 선택이 아니면 표시하지 않는다", () => {
    const { textPos, select } = setup();
    expect(selectedCellEdges(select(textPos("가") + 1))).toEqual([]);
  });
});
