// 내보내기에서 다루는 BlockNote 블록 모양 (필요한 필드만)

export interface StyledText {
  type: "text";
  text: string;
  styles?: Record<string, unknown>;
}

export interface LinkContent {
  type: "link";
  href: string;
  content: StyledText[];
}

// 본문 @멘션 (내보내기에서는 "@이름" 글자로)
export interface MentionContent {
  type: "mention";
  props?: { name?: unknown };
}

export type InlineItem = StyledText | LinkContent | MentionContent;

export interface TableCellObject {
  type: "tableCell";
  props?: Record<string, unknown>;
  content: InlineItem[];
}

export interface TableContentModel {
  type: "tableContent";
  headerRows?: number;
  headerCols?: number;
  rows: { cells: (TableCellObject | InlineItem[])[] }[];
}

export interface ExportBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: InlineItem[] | TableContentModel | undefined;
  children?: ExportBlock[];
}

// 글자 묶음과 그 모양 (PDF 한 조각)
export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  textColor?: string;
  backgroundColor?: string;
  href?: string;
}

// 인라인 내용을 모양별 글자 조각으로 펼침 (링크는 주소를 조각에 붙임)
export function toRuns(content: InlineItem[] | undefined): TextRun[] {
  if (!Array.isArray(content)) return [];
  const runs: TextRun[] = [];
  const push = (item: StyledText, href?: string) => {
    const styles = item.styles ?? {};
    runs.push({
      text: item.text,
      bold: styles.bold === true,
      italic: styles.italic === true,
      underline: styles.underline === true || href !== undefined,
      strike: styles.strike === true,
      code: styles.code === true,
      textColor: typeof styles.textColor === "string" ? styles.textColor : undefined,
      backgroundColor: typeof styles.backgroundColor === "string" ? styles.backgroundColor : undefined,
      href,
    });
  };
  for (const item of content) {
    if (item.type === "link") item.content.forEach((text) => push(text, item.href));
    else if (item.type === "text") push(item);
    else if (item.type === "mention") push({ type: "text", text: `@${String(item.props?.name ?? "")}` });
  }
  return runs;
}

// 표 칸을 칸 객체로 맞춤 (예전 형식은 인라인 내용 배열)
export function toCell(cell: TableCellObject | InlineItem[]): TableCellObject {
  return Array.isArray(cell) ? { type: "tableCell", props: {}, content: cell } : cell;
}

// 번호 목록은 바로 앞에 이어진 번호 목록 개수로 번호를 매김 (start가 있으면 그 번호부터)
export function listNumbers(blocks: ExportBlock[]): Map<number, number> {
  const numbers = new Map<number, number>();
  let current = 0;
  blocks.forEach((block, index) => {
    if (block.type !== "numberedListItem") {
      current = 0;
      return;
    }
    const start = Number(block.props?.start);
    current = current === 0 && Number.isFinite(start) && start > 0 ? start : current + 1;
    numbers.set(index, current);
  });
  return numbers;
}
