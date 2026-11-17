import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";

type AnyEditor = BlockNoteEditor<any, any, any>;

// 새 열 묶음: 같은 너비의 열마다 빈 줄 하나
export function newColumnList(count: number) {
  return {
    type: "columnList" as const,
    children: Array.from({ length: count }, () => ({ type: "column" as const, props: { width: 1 }, children: [{ type: "paragraph" as const }] })),
  };
}

// 커서가 열 안에 있는지 (열 안에는 열 묶음을 넣을 수 없음)
export function isInsideColumn(editor: AnyEditor): boolean {
  let block = editor.getParentBlock(editor.getTextCursorPosition().block);
  while (block) {
    if (block.type === "column") return true;
    block = editor.getParentBlock(block);
  }
  return false;
}

// "/2단"·"/3단": 슬래시를 친 줄(비어 있으면 그 줄을 바꾸고 아니면 아래)에 열 묶음을 넣고 첫 열로 커서를 옮김
export function insertColumns(editor: AnyEditor, count: number): void {
  if (isInsideColumn(editor)) return;
  const list = insertOrUpdateBlockForSlashMenu(editor, newColumnList(count) as any) as any;
  const first = list?.children?.[0]?.children?.[0];
  if (first) editor.setTextCursorPosition(first, "start");
}
