import { createExtension } from "@blocknote/core";
import type { Block, BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { calloutOfTitle } from "./AlignedSideMenuController";

type AnyEditor = BlockNoteEditor<any, any, any>;
type AnyBlock = Block<any, any, any>;

// 제목 글을 이어 붙일 수 있는 글 블록 (표·코드·이미지·구분선·콜아웃 등은 제외)
const TEXT_TYPES = new Set(["paragraph", "heading", "quote", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem"]);

// 화면상 콜아웃 바로 위 줄: 앞 블록의 마지막 하위 블록까지 내려감 (하위 줄이 펼쳐져 있으면 그 마지막 줄이 바로 위)
function lineAbove(editor: AnyEditor, callout: AnyBlock): AnyBlock | undefined {
  let line = editor.getPrevBlock(callout.id);
  while (line && line.children.length > 0) line = line.children[line.children.length - 1];
  return line;
}

// 노션처럼 콜아웃 제목(첫 줄) 맨 앞에서 Backspace
// 바로 위 줄이 글 블록이면 제목 글을 그 줄 끝에 이어 붙임 (위 줄 형식을 따르고 커서는 이어 붙인 자리)
// 위가 없거나 글 블록이 아니면 제목 줄을 일반 문단으로 콜아웃 바로 위에 꺼냄
// 다음 줄이 새 제목이 되고, 줄이 하나뿐이었다면 빈 콜아웃은 지움 (기본 동작은 제목1을 문단으로 바꾸기만 함)
export function liftCalloutTitle(editor: AnyEditor): boolean {
  const selection = editor.prosemirrorState.selection;
  if (!selection.empty || selection.$from.parentOffset !== 0) return false;
  const block = editor.getTextCursorPosition().block;
  const callout = calloutOfTitle(block, editor.getParentBlock(block));
  if (!callout) return false;
  const above = lineAbove(editor, callout);
  const merge = above && TEXT_TYPES.has(above.type) && Array.isArray(above.content) ? above : undefined;
  // 이어 붙일 자리 (위 줄 글 끝) 위치: 그 앞쪽 문서는 바뀌지 않으므로 그대로 씀
  let joinPos: number | undefined;
  if (merge) {
    editor.setTextCursorPosition(merge.id, "end");
    joinPos = editor.prosemirrorState.selection.from;
  }
  editor.transact(() => {
    editor.removeBlocks([block.id]);
    if (merge) {
      editor.updateBlock(merge.id, {
        content: [...(merge.content as unknown[]), ...(block.content as unknown[])] as never,
        // 제목 줄의 하위 블록은 위 줄 하위로 이어 붙임
        children: [...merge.children, ...block.children] as never,
      });
    } else {
      editor.insertBlocks([{ ...block, type: "paragraph", props: {} }], callout.id, "before");
    }
    if (editor.getBlock(callout.id)?.children.length === 0) editor.removeBlocks([callout.id]);
  });
  if (joinPos === undefined) {
    editor.setTextCursorPosition(block.id, "start");
  } else {
    const at = joinPos;
    editor.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, at)));
  }
  return true;
}

export const calloutBackspaceExtension = createExtension({
  key: "calloutBackspace",
  keyboardShortcuts: {
    // 한글 조합 중에는 글자 지우기로 둠
    Backspace: ({ editor, event }) => !event.isComposing && liftCalloutTitle(editor),
  },
});
