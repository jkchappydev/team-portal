import { blockToNode, createExtension } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import { foldCallouts, NOTION_BLOCKS_TYPE, notionBlocksInOrder, prepareNotionHtml } from "./notionPaste";
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

type AnyEditor = BlockNoteEditor<any, any, any>;

// 노션에서 복사한 표·콜아웃은 노션 HTML이 깨져 있어(칸 안 줄바꿈에서 행이 끊김, 콜아웃이 "<aside>" 글자로 옴)
// 함께 실린 원본 블록 데이터로 고친 HTML을 블록으로 바꾸고 콜아웃은 콜아웃 블록으로 묶어 붙여넣음
export function pasteFromNotion(editor: AnyEditor, data: Pick<DataTransfer, "types" | "getData">): boolean {
  if (!data.types.includes(NOTION_BLOCKS_TYPE) || !data.types.includes("text/html")) return false;
  if (editor.prosemirrorState.selection.$from.parent.type.spec.code) return false;
  const notionBlocks = notionBlocksInOrder(data.getData(NOTION_BLOCKS_TYPE));
  if (!notionBlocks.some((block) => block.type === "table" || block.type === "callout")) return false;
  const { html, callouts } = prepareNotionHtml(data.getData("text/html"), notionBlocks);
  const blocks = foldCallouts(editor.tryParseHTMLToBlocks(html), callouts);
  if (blocks.length === 0) return false;
  // 블록을 문서 노드로 바로 바꿔 붙여넣기처럼 넣음 (콜아웃은 React로 그리는 블록이라 HTML로 되돌리지 않음)
  const view = editor.prosemirrorView;
  if (!view) return false;
  const { schema } = view.state;
  const group = schema.nodes.blockGroup.create(null, blocks.map((block) => blockToNode(block, schema, editor.schema.styleSchema)));
  // 실제 붙여넣기처럼 모든 transformPasted(줄 종류 유지 등)를 차례로 거침
  let slice = new Slice(Fragment.from(group), 1, 1);
  view.someProp("transformPasted", (transform) => {
    slice = transform(slice, view, false);
  });
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
  return true;
}

export const editorPasteHandler = ({ event, editor, defaultPasteHandler }: {
  event: ClipboardEvent;
  editor: AnyEditor;
  defaultPasteHandler: (options?: { prioritizeMarkdownOverHTML?: boolean }) => boolean | undefined;
}) => {
  if (event.clipboardData && pasteFromNotion(editor, event.clipboardData)) return true;
  return defaultPasteHandler(pasteOptions(Array.from(event.clipboardData?.types ?? [])));
};

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
