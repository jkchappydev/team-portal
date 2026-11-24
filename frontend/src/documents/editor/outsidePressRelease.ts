import { createExtension } from "@blocknote/core";
import { Selection } from "@tiptap/pm/state";
import { isInFloatingUi } from "../editorEnd";

// 선택된 블록을 다루는 곳: 블록 손잡이·표 행열 손잡이·칸 메뉴 버튼·대화 상자 (눌러도 선택을 유지해야 함)
const KEEP_SELECTION = ".bn-side-menu, .bn-table-handle, .cell-selection-handle, [role='dialog']";

// 블록 전체 선택(이미지·파일·페이지 등)이나 표 여러 칸 선택은 편집기 밖을 눌렀을 때 풀어야 하는 선택
export function isBlockLevelSelection(type: string): boolean {
  return type === "node" || type === "cell";
}

// 편집기 밖을 누른 것인지 (편집 영역 안, 띄운 메뉴·툴바, 선택을 다루는 손잡이·버튼은 제외)
export function isOutsidePress(target: EventTarget | null, editorDom: Element): boolean {
  if (!(target instanceof Element) || editorDom.contains(target)) return false;
  return !isInFloatingUi(target) && !target.closest(KEEP_SELECTION);
}

// 노션처럼 이미지 등 블록을 선택한 채 편집기 밖을 누르면 선택(파란 테두리)을 풂
// 편집기는 포커스만 잃고 선택은 그대로 두어, 예전에는 바깥을 눌러도 선택 표시가 남았음
export const outsidePressReleaseExtension = createExtension(({ editor }) => ({
  key: "outsidePressRelease",
  mount: ({ signal }) => {
    document.addEventListener("mousedown", (e) => {
      const view = editor.prosemirrorView;
      if (!view || e.button !== 0) return;
      const { selection } = view.state;
      if (!isBlockLevelSelection(selection.toJSON().type) || !isOutsidePress(e.target, view.dom)) return;
      // 선택한 블록 앞쪽(없으면 뒤쪽) 가까운 글 위치로 접음 (포커스는 주지 않아 커서는 보이지 않음)
      // near()는 가장 가까운 선택 가능 위치로 이 블록 자체를 다시 고를 수 있어 글 위치만 찾음
      const text = Selection.findFrom(selection.$from, -1, true) ?? Selection.findFrom(selection.$to, 1, true);
      if (!text) return;
      view.dispatch(view.state.tr.setSelection(text));
    }, { capture: true, signal });
  },
}));
