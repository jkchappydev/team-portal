import { useEffect, useMemo, useRef } from "react";
import type { ComponentProps } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { SideMenuController, useBlockNoteEditor, useExtensionState } from "@blocknote/react";
import { firstLineCenter } from "./firstLine";

type Options = NonNullable<ComponentProps<typeof SideMenuController>["floatingUIOptions"]>;
type Middleware = NonNullable<NonNullable<Options["useFloatingOptions"]>["middleware"]>[number];

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
      const center = own ? firstLineCenter(own, block, true) ?? iconCenter(own, block) : null;
      const blockTopGap = block.getBoundingClientRect().top - reference.top;
      const y = center === null ? state.y : state.y + blockTopGap + center - state.rects.floating.height / 2;
      return { y };
    },
  };
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
      originalDragStart(event, calloutOfTitle(current, editor.getParentBlock(current)) ?? current);
    };
    // BlockNote는 마우스 아래 블록이 바뀔 때만 손잡이 대상을 다시 정함
    // 콜아웃 안 줄을 제목 자리로 끌어 놓으면 손잡이가 그 줄(이제 첫 줄)을 계속 잡고 있어 콜아웃 대신 그 줄이 끌려 나가므로 문서가 바뀔 때도 다시 확인
    const offChange = editor.onChange(() => redirect());
    return () => {
      unsubscribe();
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
