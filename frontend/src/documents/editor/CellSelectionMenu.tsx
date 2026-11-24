import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BlockNoteEditor } from "@blocknote/core";
import { TableHandlesExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor, useComponentsContext, useEditorState, usePortalElement } from "@blocknote/react";
import type { Node as PmNode, ResolvedPos } from "@tiptap/pm/model";
import { CellSelection } from "@tiptap/pm/tables";
import { cellsColor, clearCells, colorCells } from "./blockMenu";
import type { CellIndex, ColorKind, TableContent } from "./blockMenu";
import { ColorSubmenu } from "./ColorSubmenu";
import { MenuIcon } from "./MenuIcon";
import { MENU_ICONS } from "./menuIcons";
import { RANGE_CELL_CLASS } from "./activeTableCell";

// 칸의 위치를 표 위치 + 행 번호 + 칸 번호로 (표 내용을 바꿔도 다시 찾을 수 있게)
interface CellAddress {
  tablePos: number;
  row: number;
  col: number;
}

function cellAddress($cell: ResolvedPos): CellAddress {
  return { tablePos: $cell.before(-1), row: $cell.index(-1), col: $cell.index() };
}

function cellPosition(doc: PmNode, { tablePos, row, col }: CellAddress): number | undefined {
  const table = doc.nodeAt(tablePos);
  if (!table || row >= table.childCount || col >= table.child(row).childCount) return undefined;
  let pos = tablePos + 1;
  for (let r = 0; r < row; r++) pos += table.child(r).nodeSize;
  pos += 1;
  for (let c = 0; c < col; c++) pos += table.child(row).child(c).nodeSize;
  return pos;
}

// 칸 선택을 끝낸 칸(head)이 시작 칸(anchor)보다 왼쪽이면 왼쪽으로 끈 것
function dragSide(editor: Pick<BlockNoteEditor<any, any, any>, "prosemirrorView" | "prosemirrorState">): "left" | "right" {
  const view = editor.prosemirrorView;
  const selection = editor.prosemirrorState.selection;
  if (!view || !(selection instanceof CellSelection)) return "right";
  const anchor = view.nodeDOM(selection.$anchorCell.pos);
  const head = view.nodeDOM(selection.$headCell.pos);
  if (!(anchor instanceof Element) || !(head instanceof Element)) return "right";
  return head.getBoundingClientRect().left < anchor.getBoundingClientRect().left ? "left" : "right";
}

interface HandlePosition {
  // 어느 칸 선택에 대한 위치인지 (선택이 바뀌면 이전 위치는 쓰지 않음)
  key: string;
  top: number;
  left: number;
  // 버튼이 붙은 변 (메뉴도 그쪽으로 엶)
  side: "left" | "right";
}

// 노션처럼 표에서 여러 칸을 고르면 선택 범위 오른쪽 가운데에 버튼을 띄우고, 누르면 색·셀 병합·콘텐츠 삭제 메뉴를 보여줌
export function CellSelectionMenu() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  // 메뉴를 편집기 스타일 범위 안에 띄우기 위한 요소
  const portalElement = usePortalElement();
  // 칸 선택이 바뀔 때만 다시 그림 (선택 양 끝 칸 위치를 열쇠로 사용)
  const selectionKey = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const selection = e.prosemirrorState.selection;
      return e.isEditable && selection instanceof CellSelection
        ? `${selection.$anchorCell.pos}:${selection.$headCell.pos}`
        : null;
    },
  });
  const [position, setPosition] = useState<HandlePosition | null>(null);

  // 선택 범위(테두리를 그린 칸들)에서 드래그를 끝낸 쪽 변 가운데에 버튼 배치, 스크롤·창 크기 변경 시 다시 계산
  // 오른쪽으로 끌면 오른쪽 변, 왼쪽으로 끌면 왼쪽 변 (위아래로만 끌면 오른쪽)
  useLayoutEffect(() => {
    const container = editor.domElement;
    if (!selectionKey || !container) return;
    const place = () => {
      const cells = Array.from(container.querySelectorAll(`.${RANGE_CELL_CLASS}`));
      if (cells.length === 0) {
        setPosition(null);
        return;
      }
      const rects = cells.map((cell) => cell.getBoundingClientRect());
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const side = dragSide(editor);
      const left = side === "left" ? Math.min(...rects.map((r) => r.left)) : Math.max(...rects.map((r) => r.right));
      setPosition({ key: selectionKey, top: (top + bottom) / 2, left, side });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [editor, selectionKey]);

  if (!selectionKey || position?.key !== selectionKey) return null;

  // 지금 고른 표와 칸 (메뉴를 그리거나 누를 때 최신 상태로 읽음)
  const current = () => {
    const tableHandles = editor.getExtension(TableHandlesExtension);
    const cells = tableHandles?.getCellSelection()?.cells;
    const block = (editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block])[0];
    if (!tableHandles || !cells || block?.type !== "table") return undefined;
    return { tableHandles, cells, block, content: block.content as unknown as TableContent };
  };
  const selected = current();
  if (!selected) return null;

  const canMerge = selected.tableHandles.getMergeDirection(selected.block as never) !== undefined;
  // 병합된 칸 하나만 고른 경우에만 분할 가능
  const single = selected.cells.length === 1 ? selected.content.rows[selected.cells[0].row]?.cells[selected.cells[0].col] : undefined;
  const singleProps = single && !Array.isArray(single) ? single.props : {};
  const canSplit = Number(singleProps.colspan ?? 1) > 1 || Number(singleProps.rowspan ?? 1) > 1;

  // 칸 내용을 바꾼 뒤에도 노션처럼 같은 칸들을 계속 선택해 둠 (표를 다시 쓰면 칸 선택이 풀림)
  const updateContent = (next: (content: TableContent, cells: CellIndex[]) => TableContent) => {
    const latest = current();
    const selection = editor.prosemirrorState.selection;
    if (!latest || !(selection instanceof CellSelection)) return;
    const anchor = cellAddress(selection.$anchorCell);
    const head = cellAddress(selection.$headCell);
    editor.updateBlock(latest.block, { content: next(latest.content, latest.cells) as never });
    const state = editor.prosemirrorState;
    const anchorPos = cellPosition(state.doc, anchor);
    const headPos = cellPosition(state.doc, head);
    if (anchorPos !== undefined && headPos !== undefined) {
      editor.prosemirrorView?.dispatch(state.tr.setSelection(CellSelection.create(state.doc, anchorPos, headPos)));
    }
  };

  return createPortal(
    <Components.Generic.Menu.Root position={position.side === "left" ? "left-start" : "right-start"} portalElement={portalElement}>
      <Components.Generic.Menu.Trigger>
        <button
          type="button"
          className="cell-selection-handle"
          aria-label="셀 메뉴"
          style={{ top: position.top, left: position.left }}
          // 눌러도 편집기 칸 선택이 풀리지 않게 함
          onMouseDown={(e) => e.preventDefault()}
        >
          <MenuIcon d={MENU_ICONS.more} strokeWidth={2.4} />
        </button>
      </Components.Generic.Menu.Trigger>
      {/* bn-table-handle-menu: 메뉴 상자의 overflow를 풀어 "색" 하위 메뉴가 상자 밖으로 펼쳐지게 함 (블록 메뉴의 bn-drag-handle-menu와 같음) */}
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-table-handle-menu">
        <ColorSubmenu
          kinds={["textColor", "backgroundColor"]}
          current={(kind: ColorKind) => cellsColor(selected.content, selected.cells, kind)}
          onSelect={(kind, color) => updateContent((content, cells) => colorCells(content, cells, kind, color))}
        />
        {canMerge && (
          <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.merge} />}
            onClick={() => editor.getExtension(TableHandlesExtension)?.mergeCells()}>
            셀 병합
          </Components.Generic.Menu.Item>
        )}
        {canSplit && (
          <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.split} />}
            onClick={() => editor.getExtension(TableHandlesExtension)?.splitCell()}>
            셀 분할
          </Components.Generic.Menu.Item>
        )}
        <Components.Generic.Menu.Item className="bn-menu-item" icon={<MenuIcon d={MENU_ICONS.clear} />}
          onClick={() => updateContent(clearCells)}>
          콘텐츠 삭제
        </Components.Generic.Menu.Item>
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>,
    document.body,
  );
}
