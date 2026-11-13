import { useEffect, useMemo, useRef } from "react";
import type { ComponentProps } from "react";
import { SideMenuExtension, SuggestionMenu } from "@blocknote/core/extensions";
import { SideMenuController, useBlockNoteEditor, useExtensionState } from "@blocknote/react";
import { firstLineCenter } from "./firstLine";
import { marqueeSelection, selectBlockRange } from "./blockMarquee";

type Options = NonNullable<ComponentProps<typeof SideMenuController>["floatingUIOptions"]>;
type Middleware = NonNullable<NonNullable<Options["useFloatingOptions"]>["middleware"]>[number];

// 콜아웃 바깥 손잡이 버튼 위 끝을 상자 위 끝에 맞춤 (손잡이 틀 안쪽 여백 3px만큼 올림)
const CALLOUT_HANDLE_TOP = -3;
// 손잡이와 블록 사이를 기본보다 더 띄움 (콜아웃 안 본문 줄은 상자 안이 좁아 조금만)
const HANDLE_GAP = 12;
const CALLOUT_INNER_GAP = 6;

// 손잡이를 블록 첫 글줄 가운데에 맞춤 (콜아웃 안 본문 줄 손잡이는 상자 안, 바깥 손잡이는 콜아웃 전체)
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
      const type = own?.getAttribute("data-content-type");
      const center = !own ? null
        : type === "table" ? firstRowCenter(own, block)
        // 콜아웃은 표처럼 상자 위쪽에 붙임 (첫 줄 가운데는 상자 위 여백만큼 내려가 애매하게 뜸)
        : type === "callout" ? CALLOUT_HANDLE_TOP + state.rects.floating.height / 2
        : firstLineCenter(own, block, true) ?? iconCenter(own, block);
      const blockTopGap = block.getBoundingClientRect().top - reference.top;
      const y = center === null ? state.y : state.y + blockTopGap + center - state.rects.floating.height / 2;
      const inCallout = !!block.parentElement?.closest(".bn-block:has(> .node-callout)");
      return { x: state.x - (inCallout ? CALLOUT_INNER_GAP : HANDLE_GAP), y };
    },
  };
}

// 표는 노션처럼 첫 행 가운데 (표 전체 가운데로 두면 긴 표에서 손잡이가 중간에 뜸)
function firstRowCenter(own: Element, block: Element): number | null {
  const row = own.querySelector("tr");
  return row ? iconCenter(row, block) : iconCenter(own, block);
}

// 글줄이 없는 블록(콜아웃 아이콘 등)은 내용 칸의 세로 가운데
function iconCenter(own: Element, block: Element): number | null {
  const rect = own.getBoundingClientRect();
  if (rect.height === 0) return null;
  return rect.top - block.getBoundingClientRect().top + rect.height / 2;
}

// 콜아웃 첫 줄(제목)이면 그 콜아웃을, 아니면 null (노션처럼 제목 줄 손잡이는 콜아웃 전체를 잡음)
export function calloutOfTitle<T extends { id: string; type: string; children: { id: string }[] }>(
  block: { id: string },
  parent: T | undefined,
): T | null {
  return parent?.type === "callout" && parent.children[0]?.id === block.id ? parent : null;
}

// 기본 손잡이 위치 계산을 위 규칙으로 바꾼 SideMenuController
// 콜아웃 첫 줄에 마우스를 올리면 손잡이 대상을 콜아웃 전체로 바꿔 첫 줄만 끌려 나가지 않게 함 (끌기·메뉴·선택 모두 콜아웃 기준)
export function AlignedSideMenuController(props: Omit<ComponentProps<typeof SideMenuController>, "floatingUIOptions">) {
  const editor = useBlockNoteEditor();
  useEffect(() => {
    const store = editor.getExtension(SideMenuExtension)?.store;
    if (!store) return;
    const redirect = () => {
      const state = store.state;
      if (!state?.show || !state.block) return;
      const callout = calloutOfTitle(state.block, editor.getParentBlock(state.block));
      if (!callout) return;
      const element = document.querySelector(`.bn-editor .bn-block[data-id="${CSS.escape(callout.id)}"]`);
      store.setState({ ...state, block: callout, referencePos: element?.getBoundingClientRect() ?? state.referencePos });
    };
    const unsubscribe = store.subscribe(redirect);
    // 끌기 시작 순간에도 한 번 더: 손잡이 상태가 어떻든 콜아웃 첫 줄을 끌면 콜아웃 전체를 끎 (첫 줄만 빠져나가지 않음)
    const sideMenu = editor.getExtension(SideMenuExtension) as unknown as { blockDragStart: (event: unknown, block: { id: string }) => void };
    const originalDragStart = sideMenu.blockDragStart;
    sideMenu.blockDragStart = (event, block) => {
      const current = editor.getBlock(block.id) ?? block;
      const target = calloutOfTitle(current, editor.getParentBlock(current)) ?? current;
      // 끌어서 고른 여러 블록 중 하나의 손잡이를 끌면 고른 블록을 함께 옮김 (BlockNote는 편집기 선택이 여러 블록에 걸쳐 있으면 그 범위를 끎)
      const marquee = marqueeSelection(editor);
      if (marquee.length > 1 && marquee.includes(target.id)) selectBlockRange(editor, marquee);
      originalDragStart(event, target);
    };
    // BlockNote는 마우스 아래 블록이 바뀔 때만 손잡이 대상을 다시 정함
    // 콜아웃 안 줄을 제목 자리로 끌어 놓으면 손잡이가 그 줄(이제 첫 줄)을 계속 잡고 있어 콜아웃 대신 그 줄이 끌려 나가므로 문서가 바뀔 때도 다시 확인
    const offChange = editor.onChange(() => redirect());
    // 스타일(슬래시) 메뉴가 떠 있는 동안 손잡이는 숨기고(NotionSideMenu), 메뉴가 닫히면 바로 다시 보이게 함
    // BlockNote는 키를 누르면 손잡이를 숨겨 Enter로 고르면 마우스를 움직일 때까지 안 보이므로 닫힌 직후 다시 띄움
    const suggestionStore = editor.getExtension(SuggestionMenu)?.store;
    let slashOpen = false;
    let reshowTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribeSlash = suggestionStore?.subscribe(({ currentVal }) => {
      const open = !!currentVal?.show;
      if (slashOpen && !open) {
        clearTimeout(reshowTimer);
        reshowTimer = setTimeout(() => {
          const state = store.state;
          const block = state?.block && editor.getBlock(state.block.id);
          const element = block && document.querySelector(`.bn-editor .bn-block[data-id="${CSS.escape(block.id)}"]`);
          if (!state || !block || !element || state.show) return;
          store.setState({ ...state, show: true, block, referencePos: element.getBoundingClientRect() });
        }, 0);
      }
      slashOpen = open;
    });
    return () => {
      unsubscribe();
      unsubscribeSlash?.();
      clearTimeout(reshowTimer);
      offChange?.();
      sideMenu.blockDragStart = originalDragStart;
    };
  }, [editor]);
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
