import { SideMenuExtension, SuggestionMenu } from "@blocknote/core/extensions";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  DragHandleButton, SideMenu, useBlockNoteEditor, useComponentsContext, useDictionary, useExtension, useExtensionState,
} from "@blocknote/react";
import { NotionDragHandleMenu } from "./NotionDragHandleMenu";

// + 버튼: 항상 바로 아래에 일반 텍스트 줄을 새로 넣고 커서를 옮긴 뒤 스타일(슬래시) 메뉴를 띄움
// (BlockNote 기본은 지금 줄이 비어 있으면 새 줄 없이 그 줄에서 메뉴를 엶)
export function addPlainBlockBelow(editor: BlockNoteEditor<any, any, any>, blockId: string): void {
  const [inserted] = editor.insertBlocks([{ type: "paragraph" }], blockId, "after");
  editor.setTextCursorPosition(inserted.id, "start");
  editor.focus();
}

function PlainAddBlockButton() {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor();
  const suggestionMenu = useExtension(SuggestionMenu);
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  if (!block) return null;
  const add = () => {
    addPlainBlockBelow(editor, block.id);
    suggestionMenu.openSuggestionMenu("/");
  };
  return (
    <Components.SideMenu.Button
      className="bn-button"
      label={dict.side_menu.add_block_label}
      icon={(
        // BlockNote 기본 + 아이콘과 같은 모양
        <svg viewBox="0 0 1024 1024" width={24} height={24} fill="currentColor" onClick={add}>
          <path d="M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8Z" />
          <path d="M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8Z" />
        </svg>
      )}
    />
  );
}

// 블록 왼쪽 손잡이(+ ⠿)
// 콜아웃 안 본문 줄은 상자 안에 둠 (상자 바깥 손잡이는 콜아웃 전체, 제목 줄은 바깥 손잡이만 있음)
// 상자 안은 좁아 표시만 남겨 index.css에서 버튼 폭을 줄임 (.callout-side-menu)
// 스타일 메뉴가 떠 있는 동안은 숨김
export function NotionSideMenu() {
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  // 스타일(슬래시) 메뉴가 떠 있는 동안은 손잡이를 숨김 (메뉴를 고르거나 닫으면 다시 보임)
  const slashOpen = useExtensionState(SuggestionMenu, { editor, selector: (state) => !!state?.show });
  if (slashOpen) return null;
  const inCallout = !!block && (editor.getParentBlock(block)?.type as string | undefined) === "callout";
  return (
    <SideMenu>
      {inCallout && <span className="callout-side-menu" hidden />}
      <PlainAddBlockButton />
      <DragHandleButton dragHandleMenu={NotionDragHandleMenu} />
    </SideMenu>
  );
}
