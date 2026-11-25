import { isValidElement } from "react";
import type { ReactElement } from "react";
import { flip, offset, shift } from "@floating-ui/react";
import type { FloatingUIOptions } from "@blocknote/react";
import {
  BasicTextStyleButton, FormattingToolbar, getFormattingToolbarItems, useBlockNoteEditor, useComponentsContext,
  useDictionary, useEditorState, usePortalElement,
} from "@blocknote/react";
import { downloadFile } from "./fileDownload";
import { openImageLightbox } from "./ImageLightbox";
import { colorsFor } from "./blockMenu";
import type { ColorKind } from "./blockMenu";
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

// 다운로드 아이콘 (BlockNote 기본 버튼과 같은 모양)
function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z" />
    </svg>
  );
}

interface DownloadableBlock {
  type: string;
  props: { url?: unknown; name?: unknown };
}

// 파일·이미지 블록 다운로드: BlockNote 기본은 새 탭에 열어 이미지는 보기만 되므로 바로 저장되게 교체
export function FileDownloadButton() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const dict = useDictionary();
  const block = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const blocks = e.getSelection()?.blocks ?? [e.getTextCursorPosition().block];
      if (blocks.length !== 1) return undefined;
      const only = blocks[0] as unknown as DownloadableBlock;
      return typeof only.props?.url === "string" && only.props.url ? only : undefined;
    },
  });
  if (!block) return null;
  const tooltips = dict.formatting_toolbar.file_download.tooltip as Record<string, string>;
  const label = tooltips[block.type] ?? tooltips.file;
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label={label}
      mainTooltip={label}
      icon={<DownloadIcon />}
      onClick={() => {
        editor.focus();
        void downloadFile(block.props.url as string, typeof block.props.name === "string" ? block.props.name : undefined);
      }}
    />
  );
}

// 펼치기 아이콘 (돋보기 안에 +)
function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.5 12.5 17 17M8.5 6v5M6 8.5h5" />
    </svg>
  );
}

// 이미지 블록 펼치기: 노션처럼 이미지를 화면 가운데에 크게 띄움 (창은 앱 레이아웃의 ImageLightbox)
export function ImageExpandButton() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const block = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const blocks = e.getSelection()?.blocks ?? [e.getTextCursorPosition().block];
      if (blocks.length !== 1) return undefined;
      const only = blocks[0] as unknown as DownloadableBlock;
      return only.type === "image" && typeof only.props?.url === "string" && only.props.url ? only : undefined;
    },
  });
  if (!block) return null;
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label="펼치기"
      mainTooltip="펼치기"
      icon={<ExpandIcon />}
      onClick={() => openImageLightbox({
        url: block.props.url as string,
        name: typeof block.props.name === "string" ? block.props.name : "",
      })}
    />
  );
}

// 도구 막대 색 버튼 아이콘: 지금 글자색·배경색을 칠한 "A"
function ColorIcon({ textColor, backgroundColor }: { textColor?: string; backgroundColor?: string }) {
  return (
    <span className="color-swatch toolbar-color-icon" data-text-color={textColor} data-background-color={backgroundColor}>A</span>
  );
}

// 서식 도구 막대 색 버튼: BlockNote 기본 버튼은 색 목록이 고정이라 블록 메뉴와 같은 목록(글자색 검은색 포함)으로 교체
export function ColorStyleButton() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const portalElement = usePortalElement();
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      // 글자를 담는 블록을 선택했을 때만 표시
      const blocks = e.getSelection()?.blocks ?? [e.getTextCursorPosition().block];
      if (!e.isEditable || !blocks.some((b) => b.content !== undefined)) return undefined;
      const styles = e.getActiveStyles() as { textColor?: string; backgroundColor?: string };
      return { textColor: styles.textColor ?? "default", backgroundColor: styles.backgroundColor ?? "default" };
    },
  });
  if (!active) return null;

  const current = (kind: ColorKind) => (kind === "textColor" ? active.textColor : active.backgroundColor);
  const setColor = (kind: ColorKind, color: string) => {
    if (color === "default") editor.removeStyles({ [kind]: color } as never);
    else editor.addStyles({ [kind]: color } as never);
    editor.focus();
  };
  const items = (kind: ColorKind) => colorsFor(kind).map((color) => (
    <Components.Generic.Menu.Item
      key={`${kind}-${color.value}`}
      checked={current(kind) === color.value}
      icon={kind === "textColor" ? <ColorIcon textColor={color.value} /> : <ColorIcon backgroundColor={color.value} />}
      onClick={() => setColor(kind, color.value)}
    >
      {color.label}
    </Components.Generic.Menu.Item>
  ));

  return (
    <Components.Generic.Menu.Root portalElement={portalElement}>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button"
          label="색"
          mainTooltip="색"
          icon={<ColorIcon textColor={active.textColor} backgroundColor={active.backgroundColor} />}
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-color-picker-dropdown notion-color-menu">
        <Components.Generic.Menu.Label>텍스트 색상</Components.Generic.Menu.Label>
        {items("textColor")}
        <Components.Generic.Menu.Label>배경 색상</Components.Generic.Menu.Label>
        {items("backgroundColor")}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

// 버튼 순서: 블록 종류·표·파일 버튼 다음에 노션 순서(색 → 굵게·기울임·밑줄 → 서식 지우기 → 링크 → 취소선 → 코드),
// 노션에 없는 정렬·들여쓰기·댓글은 뒤에 둠
const TOOLBAR_ORDER = [
  "blockTypeSelect", "tableCellMergeButton", "fileCaptionButton", "replaceFileButton", "fileRenameButton",
  "fileDeleteButton", "imageExpandButton", "fileDownloadButton", "filePreviewButton",
  "colorStyleButton", "boldStyleButton", "italicStyleButton", "underlineStyleButton", "clearFormattingButton",
  "createLinkButton", "strikeStyleButton", "codeStyleButton",
  "textAlignLeftButton", "textAlignCenterButton", "textAlignRightButton", "nestBlockButton", "unnestBlockButton",
  "addCommentButton", "addTiptapCommentButton",
];

// 기본 서식 도구 막대 버튼에 노션처럼 코드(Ctrl+E)·서식 지우기 버튼을 더해 노션 순서로 정렬
// 순서 목록에 없는 버튼(라이브러리 업데이트로 새로 생긴 버튼)은 맨 뒤에 그대로 둠
export function formattingToolbarItems(): ReactElement[] {
  const items = [
    // 기본 다운로드 버튼(새 탭 열기)은 바로 저장하는 버튼으로 교체
    ...getFormattingToolbarItems()
      .filter((item) => !(isValidElement(item) && (item.key === "fileDownloadButton" || item.key === "colorStyleButton"))),
    <FileDownloadButton key="fileDownloadButton" />,
    // 노션 "펼치기": 이미지를 크게 보기 (다운로드 버튼 앞)
    <ImageExpandButton key="imageExpandButton" />,
    // 기본 색 버튼은 글자색 검은색이 있는 앱 색 목록 버튼으로 교체
    <ColorStyleButton key="colorStyleButton" />,
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

// 서식 도구 막대와 선택한 글 사이 간격 (기본 10px은 막대가 글에 거의 붙어 보여 조금 띄움)
export const TOOLBAR_GAP = 18;

// 서식 도구 막대 위치 옵션: 간격만 넓히고 화면 끝 밀어내기·위아래 뒤집기는 기본과 같게 둠
// 렌더마다 새 객체를 넘기면 위치 계산이 매번 다시 돌므로 모듈 상수로 둠
export const formattingToolbarFloatingOptions: FloatingUIOptions = {
  useFloatingOptions: { middleware: [offset(TOOLBAR_GAP), shift(), flip()] },
};

// 코드·서식 지우기 버튼을 더한 서식 도구 막대
export function NotionFormattingToolbar() {
  return <FormattingToolbar>{formattingToolbarItems()}</FormattingToolbar>;
}
