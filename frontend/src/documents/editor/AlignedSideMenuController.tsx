import { useMemo, useRef } from "react";
import type { ComponentProps } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { SideMenuController, useBlockNoteEditor, useExtensionState } from "@blocknote/react";
import { firstLineCenter } from "./firstLine";

type Options = NonNullable<ComponentProps<typeof SideMenuController>["floatingUIOptions"]>;
type Middleware = NonNullable<NonNullable<Options["useFloatingOptions"]>["middleware"]>[number];

// 콜아웃 안 줄의 손잡이와 상자 왼쪽 끝 사이 간격
const CALLOUT_GAP = 4;

// 손잡이를 블록 첫 글줄 가운데에 맞추고, 콜아웃 안 블록은 상자 왼쪽 바깥에 둠
// BlockNote 기본은 제목 단계별 고정값(제목1 39px 등)으로 내리는데 이 프로젝트는 제목 크기를 노션처럼 줄여 어긋남
export function alignSideMenu(currentBlockId: () => string | undefined): Middleware {
  return {
    name: "alignSideMenuToFirstLine",
    fn: (state) => {
      const blockId = currentBlockId();
      const block = blockId ? document.querySelector<HTMLElement>(`.bn-editor .bn-block[data-id="${CSS.escape(blockId)}"]`) : null;
      if (!block) return {};
      const reference = state.elements.reference.getBoundingClientRect();
      // 자기 줄만 보고 하위 블록 줄은 제외 (콜아웃은 아이콘 칸 가운데)
      const own = block.querySelector(":scope > .bn-block-content, :scope > .react-renderer > .bn-block-content");
      const center = own ? firstLineCenter(own, block, true) ?? iconCenter(own, block) : null;
      const blockTopGap = block.getBoundingClientRect().top - reference.top;
      const y = center === null ? state.y : state.y + blockTopGap + center - state.rects.floating.height / 2;
      const callout = block.parentElement?.closest<HTMLElement>(".bn-block:has(> .node-callout)");
      const x = callout ? state.x - (reference.left - callout.getBoundingClientRect().left) - CALLOUT_GAP : state.x;
      return { x, y };
    },
  };
}

// 글줄이 없는 블록(콜아웃 아이콘 등)은 내용 칸의 세로 가운데
function iconCenter(own: Element, block: Element): number | null {
  const rect = own.getBoundingClientRect();
  if (rect.height === 0) return null;
  return rect.top - block.getBoundingClientRect().top + rect.height / 2;
}

// 기본 손잡이 위치 계산을 위 규칙으로 바꾼 SideMenuController
export function AlignedSideMenuController(props: Omit<ComponentProps<typeof SideMenuController>, "floatingUIOptions">) {
  const editor = useBlockNoteEditor();
  const blockId = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block?.id });
  // BlockNote가 위치 옵션을 처음 값으로 붙잡아 두므로 손잡이 대상 블록은 매번 최신 값을 읽음
  const blockIdRef = useRef(blockId);
  blockIdRef.current = blockId;
  const floatingUIOptions = useMemo<Options>(
    () => ({ useFloatingOptions: { middleware: [alignSideMenu(() => blockIdRef.current)] } }),
    [],
  );
  return <SideMenuController {...props} floatingUIOptions={floatingUIOptions} />;
}
