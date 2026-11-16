import { placeBlockAtCursor } from "./scheduleCommand";
import type { BlockPlacementEditor } from "./scheduleCommand";

// 본문 블록 중 페이지 블록 판단에 필요한 부분만 (하위 블록까지 따라감)
export interface PageBlockNode {
  id: string;
  type?: string;
  props?: { documentId?: number };
  content?: unknown;
  children?: PageBlockNode[];
}

export interface PageBlock {
  type: "page";
  props: { documentId: number };
}

export interface PageEditor extends BlockPlacementEditor<PageBlock> {
  document: PageBlockNode[];
}

const pageBlock = (documentId: number): PageBlock => ({ type: "page", props: { documentId } });

// "/페이지": 만든 페이지를 가리키는 블록을 슬래시를 친 자리에 넣기
export function placePageBlock(editor: PageEditor, cursorBlock: PageBlockNode, documentId: number): void {
  placeBlockAtCursor(editor, cursorBlock, pageBlock(documentId));
}

// 복제할 블록 (id는 사본에서 빠짐)
export interface CopyableBlock {
  id?: string;
  type?: string;
  props?: unknown;
  content?: unknown;
  children?: CopyableBlock[];
}

// 블록 복제용 사본: id를 지우고, 페이지 블록은 페이지 사본을 만들어 그 사본을 가리키게 함 (하위 블록 안까지)
// 같은 페이지를 가리키는 블록이 둘이 되면 한쪽을 고칠 때 다른 쪽도 같이 바뀌므로 페이지째 복사
// 페이지 사본은 표시 순서가 섞이지 않도록 하나씩 차례로 만듦
export async function copyBlockWithPages<T extends CopyableBlock>(
  block: T, copyPage: (documentId: number) => Promise<number>): Promise<Omit<T, "id">> {
  const { id: _omit, children, ...rest } = block;
  void _omit;
  const props = rest.props as { documentId?: unknown } | undefined;
  if (rest.type === "page" && typeof props?.documentId === "number") {
    rest.props = { ...props, documentId: await copyPage(props.documentId) };
  }
  if (children === undefined) return rest as Omit<T, "id">;
  const copiedChildren: Omit<CopyableBlock, "id">[] = [];
  for (const child of children) copiedChildren.push(await copyBlockWithPages(child, copyPage));
  return { ...rest, children: copiedChildren } as Omit<T, "id">;
}

// 본문의 페이지 블록이 가리키는 문서 ID (콜아웃 등 하위 블록 안까지)
export function referencedPageIds(blocks: PageBlockNode[]): Set<number> {
  const ids = new Set<number>();
  const visit = (list: PageBlockNode[]) => {
    for (const block of list) {
      if (block.type === "page" && typeof block.props?.documentId === "number") ids.add(block.props.documentId);
      visit(block.children ?? []);
    }
  };
  visit(blocks);
  return ids;
}

// 기존 하위 항목 중 본문에 아직 블록이 없는 것만 주어진 순서대로 본문 맨 끝에 붙이고, 붙인 ID를 돌려줌
export function appendMissingPageBlocks(editor: PageEditor, documentIds: number[]): number[] {
  const present = referencedPageIds(editor.document);
  const missing = documentIds.filter((id, index) => !present.has(id) && documentIds.indexOf(id) === index);
  if (missing.length === 0) return [];
  editor.insertBlocks(missing.map(pageBlock), editor.document[editor.document.length - 1], "after");
  return missing;
}
