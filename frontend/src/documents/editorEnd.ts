// 본문 아래 빈 곳을 눌렀을 때 쓰는 편집기 기능만 추린 형태
export interface EndEditor {
  document: { id: string; type: string; content?: unknown }[];
  insertBlocks(blocks: { type: "paragraph" }[], reference: string, placement: "after"): { id: string }[];
  setTextCursorPosition(block: string, placement: "end"): void;
  focus(): void;
}

// 마지막 블록이 빈 문단인지 확인 (이미지·표·일정 블록이면 아래에 글을 쓸 줄이 없음)
function isEmptyParagraph(block: EndEditor["document"][number]): boolean {
  return block.type === "paragraph" && Array.isArray(block.content) && block.content.length === 0;
}

// 메뉴·팝오버처럼 본문 위에 띄운 요소 (BlockNote는 이런 요소를 본문 상자 안쪽 포털에 그림)
const FLOATING_UI = "[role='menu'], .mantine-Menu-dropdown, .mantine-Popover-dropdown, [data-floating-ui-portal]";

// 누른 곳이 본문 위에 띄운 메뉴 안인지 확인
// 본문 아래 빈 곳 처리에서 빼야 함: 표가 마지막 블록이면 칸 메뉴의 아래쪽 색 항목이 화면상 표보다 아래라,
// 누르는 순간 커서가 문서 끝으로 옮겨져 칸 선택이 풀리고 메뉴가 사라져 색이 바뀌지 않았음
export function isInFloatingUi(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(FLOATING_UI);
}

// 누른 곳이 본문 마지막 블록보다 아래인지 확인 (편집기 끝 줄 영역과 그 아래 빈 곳)
export function isBelowLastBlock(container: HTMLElement, clientY: number): boolean {
  const blocks = container.querySelectorAll(".bn-editor > .bn-block-group > .bn-block-outer");
  const last = blocks[blocks.length - 1];
  return last !== undefined && clientY > last.getBoundingClientRect().bottom;
}

// 이미지처럼 블록 전체가 선택된 상태에서 다른 글 줄을 누를 때 쓰는 편집기 기능만 추린 형태
export interface SelectionEditor {
  prosemirrorState: { selection: { toJSON(): { type: string } } };
  setTextCursorPosition(block: string, placement: "end"): void;
}

// 블록 전체 선택(이미지 등) 중에 다른 글 줄을 누르면 먼저 그 줄로 커서를 옮겨 선택을 풂
// 편집기는 블록이 선택된 상태의 클릭을 끌기 시작으로 보고 커서를 옮기지 않아, 여러 번 눌러야 입력되던 문제
// 커서만 옮기고 클릭은 그대로 편집기에 넘기므로 글자 사이 정확한 위치는 편집기가 다시 잡음
export function releaseBlockSelection(editor: SelectionEditor, target: Element): void {
  if (editor.prosemirrorState.selection.toJSON().type !== "node") return;
  if (target.closest(".ProseMirror-selectednode")) return;
  const content = target.closest(".bn-block-content");
  if (!content?.querySelector(".bn-inline-content")) return;
  const id = content.closest(".bn-block")?.getAttribute("data-id");
  if (id) editor.setTextCursorPosition(id, "end");
}

// 노션처럼 본문 아래 빈 곳을 누르면 마지막 빈 줄로 커서를 옮기고, 빈 줄이 없으면 새로 만듦
export function focusEditorEnd(editor: EndEditor): void {
  const last = editor.document[editor.document.length - 1];
  if (!last) return;
  const target = isEmptyParagraph(last) ? last.id : editor.insertBlocks([{ type: "paragraph" }], last.id, "after")[0].id;
  editor.setTextCursorPosition(target, "end");
  editor.focus();
}
