// 편집기에 떨어뜨린 파일을 떨어뜨린 위치에 순서대로 넣고 동시에 업로드

export type Placement = "before" | "after";

export interface DropTarget {
  // 기준 블록 (null이면 문서 맨 끝)
  blockId: string | null;
  placement: Placement;
}

type FileBlockType = "image" | "video" | "audio" | "file";

interface DropBlock {
  id: string;
  type: string;
  content?: unknown;
}

interface NewFileBlock {
  type: FileBlockType;
  props: { name: string };
}

// 드롭 처리에 필요한 BlockNote 편집기 기능만 추린 형태
export interface DropEditor {
  document: DropBlock[];
  getBlock(id: string): DropBlock | undefined;
  insertBlocks(blocks: NewFileBlock[], reference: DropBlock, placement: Placement): DropBlock[];
  updateBlock(block: DropBlock | string, update: NewFileBlock | { props: { url: string } }): unknown;
  removeBlocks(ids: string[]): unknown;
}

// SVG는 서버가 다운로드로만 내려주므로 이미지 블록이 아닌 파일 블록으로 처리
export function blockTypeForFile(file: File): FileBlockType {
  if (file.type === "image/svg+xml") return "file";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

// 마우스 위치의 블록과 그 블록의 위·아래 절반 중 어디에 놓을지 계산
export function dropTargetAt(root: HTMLElement, clientX: number, clientY: number): DropTarget {
  const element = typeof document.elementFromPoint === "function" ? document.elementFromPoint(clientX, clientY) : null;
  const blockElement = element?.closest<HTMLElement>(".bn-block-outer[data-id]");
  if (!blockElement || !root.contains(blockElement)) {
    return { blockId: null, placement: "after" };
  }
  const rect = blockElement.getBoundingClientRect();
  return {
    blockId: blockElement.dataset.id ?? null,
    placement: clientY < (rect.top + rect.bottom) / 2 ? "before" : "after",
  };
}

// 내용이 없는 문단은 새 줄을 끼우지 않고 그 자리를 파일 블록으로 바꿈
function isEmptyParagraph(block: DropBlock): boolean {
  return block.type === "paragraph" && Array.isArray(block.content) && block.content.length === 0;
}

// 업로드에 실패한 파일 이름 목록을 반환하고, 실패한 파일의 빈 블록은 제거
export async function insertDroppedFiles(
  editor: DropEditor,
  files: File[],
  target: DropTarget,
  upload: (file: File) => Promise<string>,
): Promise<string[]> {
  let reference = target.blockId ? editor.getBlock(target.blockId) : undefined;
  let placement: Placement = target.placement;
  if (!reference) {
    reference = editor.document[editor.document.length - 1];
    placement = "after";
  }
  if (!reference || files.length === 0) {
    return files.map((file) => file.name);
  }

  // 선택한 순서를 유지하도록 두 번째 파일부터는 바로 앞 파일 블록 뒤에 삽입
  const ids: string[] = [];
  for (const [index, file] of files.entries()) {
    const block: NewFileBlock = { type: blockTypeForFile(file), props: { name: file.name } };
    let id: string;
    if (index === 0 && isEmptyParagraph(reference)) {
      editor.updateBlock(reference, block);
      id = reference.id;
    } else {
      id = editor.insertBlocks([block], reference, placement)[0].id;
    }
    ids.push(id);
    reference = editor.getBlock(id) ?? reference;
    placement = "after";
  }

  const results = await Promise.allSettled(files.map((file) => upload(file)));
  const failed: string[] = [];
  const failedIds: string[] = [];
  results.forEach((result, index) => {
    const id = ids[index];
    if (result.status === "fulfilled") {
      // 업로드 중 다른 사용자가 블록을 지웠으면 건너뜀
      if (editor.getBlock(id)) editor.updateBlock(id, { props: { url: result.value } });
    } else {
      failed.push(files[index].name);
      if (editor.getBlock(id)) failedIds.push(id);
    }
  });
  if (failedIds.length > 0) editor.removeBlocks(failedIds);
  return failed;
}
