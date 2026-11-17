import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { Node as PMNode } from "@tiptap/pm/model";

// 붙여넣기 해석 방식: 서식(HTML)이 함께 오면 항상 HTML을 쓰고, 일반 텍스트만 올 때만 마크다운 여부를 판단
// BlockNote 기본은 HTML이 있어도 일반 텍스트가 마크다운처럼 보이면 마크다운을 우선해,
// 노션 표처럼 글자 안에 "index_analyzer search_analyzer"(밑줄 두 개 = 기울임 표시로 오인)가 있으면 표가 글 한 덩어리로 들어감
export function pasteOptions(types: readonly string[]): { prioritizeMarkdownOverHTML: boolean } {
  return { prioritizeMarkdownOverHTML: !types.includes("text/html") };
}

export const editorPasteHandler = ({ event, defaultPasteHandler }: {
  event: ClipboardEvent;
  defaultPasteHandler: (options?: { prioritizeMarkdownOverHTML?: boolean }) => boolean | undefined;
}) => defaultPasteHandler(pasteOptions(Array.from(event.clipboardData?.types ?? [])));

// 붙여넣은 내용이 하위 블록 없는 글 블록 하나뿐이면 그 블록의 글줄을 돌려줌
function singleTextblock(fragment: Fragment): PMNode | null {
  if (fragment.childCount !== 1) return null;
  const node = fragment.firstChild!;
  if (node.isTextblock) return node;
  // blockGroup·blockContainer 안으로 내려가며, 하위 블록(두 번째 자식)이 있으면 블록 하나로 보지 않음
  if (node.type.name === "blockGroup") return singleTextblock(node.content);
  if (node.type.name === "blockContainer" && node.childCount === 1) return singleTextblock(node.content);
  return null;
}

// 블록 묶음 안 블록이 하위 블록 없는 빈 글줄인지 (드래그가 옆 줄 첫머리·끝까지 걸쳐 딸려 온 빈 조각)
function isEmptyLineBlock(node: PMNode | null): boolean {
  return !!node && node.type.name === "blockContainer" && node.childCount === 1
    && node.firstChild!.isTextblock && node.firstChild!.content.size === 0;
}

// 여러 줄을 드래그해 복사하면 선택이 걸친 앞·뒤 줄이 빈 블록 조각으로 딸려 와,
// 붙여넣을 때 그 빈 조각이 새 블록(빈 토글 등)이 되면서 원래 블록이 갈라지고 안의 블록이 빈 조각 쪽으로 옮겨감
// 열린 앞·뒤 끝의 빈 조각을 떼어 실제 고른 글만 붙여넣음
export function trimEmptyEdgeBlocks(slice: Slice): Slice {
  const group = slice.content.childCount === 1 ? slice.content.firstChild! : null;
  if (!group || group.type.name !== "blockGroup" || group.childCount < 2) return slice;
  let children: PMNode[] = [];
  group.forEach((child) => children.push(child));
  // 깊이 3 = blockGroup > blockContainer > 글줄까지 열린 끝
  if (slice.openEnd >= 3 && isEmptyLineBlock(children[children.length - 1])) children = children.slice(0, -1);
  if (slice.openStart >= 3 && children.length > 1 && isEmptyLineBlock(children[0])) children = children.slice(1);
  if (children.length === group.childCount) return slice;
  return new Slice(Fragment.from(group.copy(Fragment.fromArray(children))), slice.openStart, slice.openEnd);
}

// 일반 문단·코드가 아닌 줄(토글·체크리스트·목록·제목·인용 등)에 블록 하나를 붙여넣으면 글자만 넣음
// 기본 동작은 하위 블록 없는 줄을 붙여넣은 블록(제목 등)으로 통째로 바꿔 토글·체크리스트가 사라짐
export function keepLineTypeOnPaste(slice: Slice, state: EditorState): Slice {
  const target = state.selection.$from.parent;
  if (!state.selection.$from.sameParent(state.selection.$to)) return slice;
  if (!target.isTextblock || target.type.name === "paragraph" || target.type.spec.code) return slice;
  const line = singleTextblock(slice.content);
  if (!line || line.type.spec.code || line.content.size === 0) return slice;
  return new Slice(line.content, 0, 0);
}

export const keepLineTypeOnPasteExtension = createExtension({
  key: "keepLineTypeOnPaste",
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("keepLineTypeOnPaste"),
      props: { transformPasted: (slice, view) => keepLineTypeOnPaste(trimEmptyEdgeBlocks(slice), view.state) },
    }),
  ],
});
