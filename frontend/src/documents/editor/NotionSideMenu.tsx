import { SideMenuExtension } from "@blocknote/core/extensions";
import { AddBlockButton, DragHandleButton, SideMenu, useBlockNoteEditor, useExtensionState } from "@blocknote/react";
import { NotionDragHandleMenu } from "./NotionDragHandleMenu";

// 블록 왼쪽 손잡이(+ ⠿)
// 콜아웃 안 본문 줄은 상자 안에 ⠿만 둠 (상자 바깥 손잡이는 콜아웃 전체, 제목 줄은 바깥 손잡이만 있음)
export function NotionSideMenu() {
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  const inCallout = !!block && (editor.getParentBlock(block)?.type as string | undefined) === "callout";
  return (
    <SideMenu>
      {!inCallout && <AddBlockButton />}
      <DragHandleButton dragHandleMenu={NotionDragHandleMenu} />
    </SideMenu>
  );
}
