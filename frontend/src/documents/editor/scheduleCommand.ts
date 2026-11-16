// 슬래시 메뉴 "/일정"·"/페이지"가 블록을 넣을 때 쓰는 편집기 기능만 추린 형태 (테스트에서 가짜 편집기로 대체)
interface CursorBlockTarget {
  id: string;
  content?: unknown;
}

export interface BlockPlacementEditor<B> {
  getBlock: (id: string) => unknown;
  updateBlock: (block: CursorBlockTarget, update: B) => unknown;
  insertBlocks: (blocks: B[], reference: CursorBlockTarget, placement: "after") => unknown;
  document: CursorBlockTarget[];
}

export interface ScheduleBlock {
  type: "schedule";
  props: { documentId: number };
}

export type ScheduleEditor = BlockPlacementEditor<ScheduleBlock>;

// 슬래시를 입력한 줄이 비어 있으면 그 줄을 새 블록으로 바꾸고, 글자가 있으면 그 아래에 넣음
// 블록을 만드는 동안(서버 요청 중) 그 줄이 지워졌으면 본문 맨 끝에 넣음
export function placeBlockAtCursor<B>(editor: BlockPlacementEditor<B>, cursorBlock: CursorBlockTarget, block: B): void {
  const stillThere = !!editor.getBlock(cursorBlock.id);
  const isEmpty = Array.isArray(cursorBlock.content) && cursorBlock.content.length === 0;
  if (stillThere && isEmpty) {
    editor.updateBlock(cursorBlock, block);
    return;
  }
  const reference = stillThere ? cursorBlock : editor.document[editor.document.length - 1];
  editor.insertBlocks([block], reference, "after");
}

// "/일정": 만든 WBS 항목을 가리키는 일정 블록 넣기
export function placeScheduleBlock(editor: ScheduleEditor, cursorBlock: CursorBlockTarget, documentId: number): void {
  placeBlockAtCursor(editor, cursorBlock, { type: "schedule", props: { documentId } });
}
