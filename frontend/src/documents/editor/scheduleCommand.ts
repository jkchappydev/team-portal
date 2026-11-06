// 슬래시 메뉴 "/일정"이 일정 블록을 넣을 때 쓰는 편집기 기능만 추린 형태 (테스트에서 가짜 편집기로 대체)
interface ScheduleBlockTarget {
  id: string;
  content?: unknown;
}

export interface ScheduleEditor {
  getBlock: (id: string) => unknown;
  updateBlock: (block: ScheduleBlockTarget, update: ScheduleBlock) => unknown;
  insertBlocks: (blocks: ScheduleBlock[], reference: ScheduleBlockTarget, placement: "after") => unknown;
  document: ScheduleBlockTarget[];
}

export interface ScheduleBlock {
  type: "schedule";
  props: { documentId: number };
}

// 슬래시를 입력한 줄이 비어 있으면 그 줄을 일정 블록으로 바꾸고, 글자가 있으면 그 아래에 넣음
// WBS를 만드는 동안 그 줄이 지워졌으면 본문 맨 끝에 넣음
export function placeScheduleBlock(editor: ScheduleEditor, cursorBlock: ScheduleBlockTarget, documentId: number): void {
  const schedule: ScheduleBlock = { type: "schedule", props: { documentId } };
  const stillThere = !!editor.getBlock(cursorBlock.id);
  const isEmpty = Array.isArray(cursorBlock.content) && cursorBlock.content.length === 0;
  if (stillThere && isEmpty) {
    editor.updateBlock(cursorBlock, schedule);
    return;
  }
  const reference = stillThere ? cursorBlock : editor.document[editor.document.length - 1];
  editor.insertBlocks([schedule], reference, "after");
}
