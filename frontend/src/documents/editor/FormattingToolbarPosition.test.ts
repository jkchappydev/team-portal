import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { CellSelection } from "@tiptap/pm/tables";
import { editorSchema } from "./schema";
import { selectionRect } from "./FormattingToolbarPosition";

const mounted: { unmount: () => void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((editor) => editor.unmount());
  document.body.replaceChildren();
});

const cell = (text: string) => ({ type: "tableCell", content: [{ type: "text", text, styles: {} }] });

function tableEditor() {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          { cells: [cell("a1"), cell("b1"), cell("c1")] },
          { cells: [cell("a2"), cell("b2"), cell("c2")] },
          { cells: [cell("a3"), cell("b3"), cell("c3")] },
        ],
      },
    }] as never,
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  editor.mount(host);
  mounted.push(editor);
  return editor;
}

// 표 칸 위치 목록 (행 순서대로)
function cellPositions(editor: BlockNoteEditor<any, any, any>): number[][] {
  const rows: number[][] = [];
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "tableRow") return true;
    const row: number[] = [];
    node.forEach((_child, offset) => row.push(pos + 1 + offset));
    rows.push(row);
    return false;
  });
  return rows;
}

describe("selectionRect", () => {
  // 예전에는 드래그를 끝낸 칸 하나 위에 막대가 떠서 그 위쪽 고른 칸들을 가렸음
  it("표 여러 칸 선택은 끝 칸이 아니라 고른 칸 전체를 감싼 영역을 기준으로 한다", () => {
    const editor = tableEditor();
    const view = editor.prosemirrorView;
    const cells = cellPositions(editor);
    // 칸마다 가짜 화면 위치: 행마다 40px, 칸마다 100px
    cells.forEach((row, r) => row.forEach((pos, c) => {
      const dom = view.nodeDOM(pos) as HTMLElement;
      dom.getBoundingClientRect = () => new DOMRect(c * 100, r * 40, 100, 40);
    }));
    // 왼쪽 위(a1)에서 오른쪽 아래(c3)로 드래그: 끝 칸은 c3
    const doc = view.state.doc;
    view.dispatch(view.state.tr.setSelection(CellSelection.create(doc, cells[0][0], cells[2][2])));
    const rect = selectionRect(view);
    expect([rect.left, rect.top, rect.width, rect.height]).toEqual([0, 0, 300, 120]);
  });

  it("일부 칸만 고르면 그 칸들만 감싼다", () => {
    const editor = tableEditor();
    const view = editor.prosemirrorView;
    const cells = cellPositions(editor);
    cells.forEach((row, r) => row.forEach((pos, c) => {
      const dom = view.nodeDOM(pos) as HTMLElement;
      dom.getBoundingClientRect = () => new DOMRect(c * 100, r * 40, 100, 40);
    }));
    view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, cells[2][1], cells[1][2])));
    const rect = selectionRect(view);
    expect([rect.left, rect.top, rect.width, rect.height]).toEqual([100, 40, 200, 80]);
  });
});
