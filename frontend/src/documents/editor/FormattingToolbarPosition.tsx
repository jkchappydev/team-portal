import { useMemo } from "react";
import { blockHasType, defaultProps, isTouchDevice } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import {
  FormattingToolbarController, GenericPopover, useBlockNoteEditor, useEditorDOMElement, useEditorState, useExtension,
  useExtensionState, useVirtualKeyboard,
} from "@blocknote/react";
import type { FloatingUIOptions, GenericPopoverReference } from "@blocknote/react";
import { flip, offset, shift } from "@floating-ui/react";
import { CellSelection } from "@tiptap/pm/tables";
import { NotionFormattingToolbar } from "./formattingToolbar";

// 서식 도구 막대와 선택한 글 사이 간격 (기본 10px은 막대가 글에 거의 붙어 보여 조금 띄움)
const TOOLBAR_GAP = 18;

type View = Pick<BlockNoteEditor<any, any, any>["prosemirrorView"], "state" | "nodeDOM" | "coordsAtPos">;

// 서식 도구 막대를 붙일 선택 영역의 화면 위치
// 표 여러 칸 선택은 BlockNote 기본 위치가 드래그를 끝낸 칸 하나라 막대가 그 위 칸들을 가렸음 → 고른 칸 전체를 감싼 영역 위에 띄움
export function selectionRect(view: View): DOMRect {
  const { selection } = view.state;
  if (selection instanceof CellSelection) {
    const rects: DOMRect[] = [];
    selection.forEachCell((_node, pos) => {
      const dom = view.nodeDOM(pos);
      if (dom instanceof Element) rects.push(dom.getBoundingClientRect());
    });
    if (rects.length > 0) {
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return new DOMRect(left, top, right - left, bottom - top);
    }
  }
  // 글 선택은 기본과 같이 선택 시작·끝 글자 위치를 감싼 영역
  const start = view.coordsAtPos(selection.from);
  const end = view.coordsAtPos(selection.to, -1);
  const left = Math.min(start.left, end.left);
  const top = Math.min(start.top, end.top);
  return new DOMRect(left, top, Math.max(start.right, end.right) - left, Math.max(start.bottom, end.bottom) - top);
}

// 글 정렬에 맞춘 막대 위치 (기본 동작과 같음)
function placementFor(textAlignment: unknown) {
  if (textAlignment === "center") return "top";
  if (textAlignment === "right") return "top-end";
  return "top-start";
}

// 데스크톱 서식 도구 막대: BlockNote 기본 컨트롤러와 같되 막대 위치 기준만 selectionRect로 바꿈
function DesktopFormattingToolbar() {
  const editor = useBlockNoteEditor<any, any, any>();
  const toolbar = useExtension(FormattingToolbarExtension, { editor });
  const show = useExtensionState(FormattingToolbarExtension, { editor });
  const editorDom = useEditorDOMElement();

  // 선택이 바뀌면 위치를 다시 잡음 (칸 선택은 시작 칸만 바뀌어도 영역이 달라지므로 선택 전체로 비교)
  const selectionKey = useEditorState({
    editor,
    selector: ({ editor }) =>
      toolbar.store.state ? JSON.stringify(editor.prosemirrorState.selection.toJSON()) : undefined,
  });
  const placement = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = editor.getTextCursorPosition().block;
      return blockHasType(block, editor, block.type, { textAlignment: defaultProps.textAlignment })
        ? placementFor(block.props.textAlignment)
        : "top-start";
    },
  });

  const reference = useMemo<GenericPopoverReference | undefined>(() => {
    if (selectionKey === undefined) return undefined;
    return {
      // 편집기 상자 자체가 스크롤될 수 있어 첫 자식을 기준 요소로 둬야 스크롤 때 위치가 따라감
      element: editorDom?.firstElementChild || undefined,
      getBoundingClientRect: () => selectionRect(editor.prosemirrorView),
    };
  }, [editor, editorDom, selectionKey]);

  const options = useMemo<FloatingUIOptions>(() => ({
    useFloatingOptions: {
      open: show,
      // 바깥 누르기·Esc로 닫힐 때 상태 반영, Esc면 편집기로 포커스 되돌림
      onOpenChange: (open, _event, reason) => {
        toolbar.store.setState(open);
        if (reason === "escape-key") editor.focus();
      },
      placement,
      middleware: [offset(TOOLBAR_GAP), shift(), flip()],
    },
    focusManagerProps: { disabled: true },
    elementProps: { style: { zIndex: 40 } },
  }), [show, placement, toolbar.store, editor]);

  return (
    <GenericPopover reference={reference} {...options}>
      {selectionKey !== undefined && show && <NotionFormattingToolbar />}
    </GenericPopover>
  );
}

// 서식 도구 막대 (코드·서식 지우기 버튼 포함), 모바일 가상 키보드가 열려 있으면 기본 하단 막대 사용
export function NotionFormattingToolbarController() {
  const keyboardOpen = useVirtualKeyboard();
  if (isTouchDevice() && keyboardOpen) return <FormattingToolbarController formattingToolbar={NotionFormattingToolbar} />;
  return <DesktopFormattingToolbar />;
}
