import { MantineProvider } from "@mantine/core";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CellSelection } from "@tiptap/pm/tables";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { editorSchema } from "./schema";
import { activeTableCellExtension } from "./activeTableCell";
import { CellSelectionMenu } from "./CellSelectionMenu";

// 실제 문서처럼 회색 배경이 칠해져 있고 링크가 든 칸
const cell = (text: string) => ({
  type: "tableCell",
  content: [{ type: "link", href: `https://example.com/${text}`, content: [{ type: "text", text, styles: {} }] }],
  props: { backgroundColor: "gray" },
});

function makeEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    extensions: [activeTableCellExtension],
    initialContent: [{
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          { cells: [cell("a1"), cell("b1"), cell("c1")] },
          { cells: [cell("a2"), cell("b2"), cell("c2")] },
        ],
      },
    }] as never,
  });
}

// 표 안 칸 위치 (행·칸 번호)
function cellPos(editor: BlockNoteEditor<any, any, any>, row: number, col: number): number {
  let found = -1;
  let r = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === "tableRow") {
      r++;
      if (r === row) {
        let p = pos + 1;
        for (let c = 0; c < col; c++) p += node.child(c).nodeSize;
        found = p;
      }
      return false;
    }
    return true;
  });
  return found;
}

describe("CellSelectionMenu", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it.each([["오른쪽", [0, 1], [1, 2]], ["왼쪽", [0, 2], [1, 1]]])("%s으로 끌어 고른 칸에 배경색을 칠한다", async (_dir, anchor, head) => {
    const editor = makeEditor();
    render(
      <MantineProvider>
        <BlockNoteView editor={editor} tableHandles={false} sideMenu={false}>
          <CellSelectionMenu />
        </BlockNoteView>
      </MantineProvider>,
    );
    act(() => {
      const state = editor.prosemirrorState;
      const sel = CellSelection.create(state.doc, cellPos(editor, anchor[0], anchor[1]), cellPos(editor, head[0], head[1]));
      editor.prosemirrorView.dispatch(state.tr.setSelection(sel));
    });
    fireEvent.click(await screen.findByLabelText("셀 메뉴"));
    const colorItem = (await screen.findByText("색")).closest("button")!;
    fireEvent.mouseEnter(colorItem);
    fireEvent.pointerEnter(colorItem);
    fireEvent.click(colorItem);
    const pink = await screen.findByText("분홍색 배경");
    fireEvent.click(pink);
    const rows = (editor.document[0].content as any).rows;
    const colors = rows.map((row: any) => row.cells.map((c: any) => c.props.backgroundColor ?? "default"));
    expect(colors).toEqual([["gray", "pink", "pink"], ["gray", "pink", "pink"]]);
  });
});
