import { createExtension, formatKeyboardShortcut, mapTableCell } from "@blocknote/core";
import type { Extension } from "@blocknote/core";
import { TableHandlesExtension } from "@blocknote/core/extensions";

// 단축키 처리 함수가 받는 편집기
type ShortcutEditor = Parameters<NonNullable<Extension["keyboardShortcuts"]>[string]>[0]["editor"];
export type Alignment = "left" | "center" | "right";

// 서식 도구 막대 버튼에 붙이는 단축키 (Google Docs와 같은 조합)
export const FORMAT_SHORTCUTS = {
  code: "Mod+E",
  clearFormatting: "Mod+\\",
  alignLeft: "Mod+Shift+L",
  alignCenter: "Mod+Shift+E",
  alignRight: "Mod+Shift+R",
} as const;

// 툴팁에 보이는 단축키 문구 (Windows는 Ctrl, Mac은 ⌘)
export function shortcutLabel(shortcut: string): string {
  return formatKeyboardShortcut(shortcut, "Ctrl");
}

// 서식 지우기로 걷어 내는 글자 서식 (링크는 서식이 아니라 남김)
const CLEARABLE_STYLES = ["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor"];

// 선택한 글자의 굵게·기울임·밑줄·취소선·코드·색을 한 번에 지움
export function clearFormatting(editor: Pick<ShortcutEditor, "removeStyles">): void {
  editor.removeStyles(Object.fromEntries(CLEARABLE_STYLES.map((style) => [style, true])));
}

// 선택한 블록(또는 표에서 고른 칸)의 글 정렬 변경, BlockNote 정렬 버튼과 같은 규칙
// 정렬할 수 없는 곳(코드 블록 등)이면 false를 돌려 다른 단축키 처리에 넘김
export function alignSelection(editor: ShortcutEditor, alignment: Alignment): boolean {
  const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
  const alignable = blocks.filter((block) => "textAlignment" in block.props);
  if (alignable.length > 0) {
    editor.transact(() => {
      for (const block of alignable) editor.updateBlock(block, { props: { textAlignment: alignment } });
    });
    return true;
  }
  const table = blocks[0];
  const content = table.content;
  if (blocks.length !== 1 || table.type !== "table" || content === undefined || Array.isArray(content)
    || content.type !== "tableContent") return false;
  const cells = editor.getExtension(TableHandlesExtension)?.getCellSelection()?.cells;
  if (!cells) return false;
  const rows = content.rows.map((row) => ({ ...row, cells: row.cells.map((cell) => mapTableCell(cell)) }));
  for (const { row, col } of cells) rows[row].cells[col].props.textAlignment = alignment;
  editor.updateBlock(table, { type: "table", content: { ...content, rows } });
  return true;
}

// 키 이름은 ProseMirror 형식 (Mod = Windows Ctrl, Mac ⌘)
export const formatShortcutsExtension = createExtension({
  key: "formatShortcuts",
  keyboardShortcuts: {
    "Mod-\\": ({ editor }) => {
      clearFormatting(editor);
      return true;
    },
    "Mod-Shift-l": ({ editor }) => alignSelection(editor, "left"),
    "Mod-Shift-e": ({ editor }) => alignSelection(editor, "center"),
    "Mod-Shift-r": ({ editor }) => alignSelection(editor, "right"),
  },
});
