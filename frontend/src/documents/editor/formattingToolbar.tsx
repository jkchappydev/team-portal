import { isValidElement } from "react";
import type { ReactElement } from "react";
import {
  BasicTextStyleButton, FormattingToolbar, getFormattingToolbarItems, useBlockNoteEditor, useComponentsContext,
  useEditorState,
} from "@blocknote/react";
import { clearFormatting, FORMAT_SHORTCUTS, shortcutLabel } from "./formatShortcuts";

// 노션의 "Tx" 아이콘 (T와 x)
function ClearFormattingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 4.5h9M8 4.5v11" />
      <path d="M12 12l4 4M16 12l-4 4" />
    </svg>
  );
}

// 선택한 글자의 굵게·기울임·밑줄·취소선·코드·색을 한 번에 지우는 버튼
export function ClearFormattingButton() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  // 글자를 담는 블록을 선택했을 때만 표시 (이미지 등 글자가 없는 블록 선택 시 숨김)
  const visible = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e.isEditable && (e.getSelection()?.blocks ?? [e.getTextCursorPosition().block]).some((b) => b.content !== undefined),
  });
  if (!visible) return null;
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label="서식 지우기"
      mainTooltip="서식 지우기"
      secondaryTooltip={shortcutLabel(FORMAT_SHORTCUTS.clearFormatting)}
      icon={<ClearFormattingIcon />}
      onClick={() => {
        editor.focus();
        clearFormatting(editor);
      }}
    />
  );
}

// 버튼 순서: 블록 종류·표·파일 버튼 다음에 노션 순서(색 → 굵게·기울임·밑줄 → 서식 지우기 → 링크 → 취소선 → 코드),
// 노션에 없는 정렬·들여쓰기·댓글은 뒤에 둠
const TOOLBAR_ORDER = [
  "blockTypeSelect", "tableCellMergeButton", "fileCaptionButton", "replaceFileButton", "fileRenameButton",
  "fileDeleteButton", "fileDownloadButton", "filePreviewButton",
  "colorStyleButton", "boldStyleButton", "italicStyleButton", "underlineStyleButton", "clearFormattingButton",
  "createLinkButton", "strikeStyleButton", "codeStyleButton",
  "textAlignLeftButton", "textAlignCenterButton", "textAlignRightButton", "nestBlockButton", "unnestBlockButton",
  "addCommentButton", "addTiptapCommentButton",
];

// 기본 서식 도구 막대 버튼에 노션처럼 코드(Ctrl+E)·서식 지우기 버튼을 더해 노션 순서로 정렬
// 순서 목록에 없는 버튼(라이브러리 업데이트로 새로 생긴 버튼)은 맨 뒤에 그대로 둠
export function formattingToolbarItems(): ReactElement[] {
  const items = [
    ...getFormattingToolbarItems(),
    <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />,
    <ClearFormattingButton key="clearFormattingButton" />,
  ];
  const rank = (item: ReactElement) => {
    const index = isValidElement(item) && item.key !== null ? TOOLBAR_ORDER.indexOf(item.key) : -1;
    return index < 0 ? TOOLBAR_ORDER.length : index;
  };
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

// 코드·서식 지우기 버튼을 더한 서식 도구 막대
export function NotionFormattingToolbar() {
  return <FormattingToolbar>{formattingToolbarItems()}</FormattingToolbar>;
}
