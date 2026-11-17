import { COLOR_NAMES } from "./colorStyles";

// 노션이 복사할 때 함께 싣는 원본 블록 데이터 형식
export const NOTION_BLOCKS_TYPE = "text/_notion-blocks-v3-production";

type RichText = [string, ([string] | [string, string])[]?][];

interface NotionBlock {
  id: string;
  type: string;
  content?: string[];
  properties?: Record<string, RichText>;
  format?: {
    page_icon?: string;
    block_color?: string;
    table_block_column_order?: string[];
    table_block_column_header?: boolean;
    table_block_row_header?: boolean;
  };
}

interface NotionClipboard {
  blocks?: { blockId: string; blockSubtree?: { block?: Record<string, { value?: NotionBlock }> } }[];
}

export interface NotionCallout {
  icon: string;
  backgroundColor: string;
  textColor: string;
}

// 복사한 블록을 문서 순서(하위 블록 포함)대로 나열
export function notionBlocksInOrder(json: string): NotionBlock[] {
  let data: NotionClipboard;
  try {
    data = JSON.parse(json) as NotionClipboard;
  } catch {
    return [];
  }
  const ordered: NotionBlock[] = [];
  for (const root of data.blocks ?? []) {
    const map = root.blockSubtree?.block ?? {};
    const visit = (id: string) => {
      const block = map[id]?.value;
      if (!block) return;
      ordered.push(block);
      block.content?.forEach(visit);
    };
    visit(root.blockId);
  }
  return ordered;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 노션 색 이름(red, red_background)을 앱 색 이름으로, 모르는 색은 버림
function colorName(value: string | undefined): { name: string; background: boolean } | undefined {
  const match = /^([a-z]+?)(_background)?$/.exec(value ?? "");
  if (!match || !(COLOR_NAMES as readonly string[]).includes(match[1])) return undefined;
  return { name: match[1], background: !!match[2] };
}

// 노션 서식 글자(굵게·기울임·취소선·밑줄·코드·링크·색)를 HTML로, 칸 안 줄바꿈은 <br>로 유지
export function richTextToHtml(text: RichText | undefined): string {
  return (text ?? []).map(([value, annotations = []]) => {
    let html = escapeHtml(value).replace(/\n/g, "<br>");
    for (const [kind, arg] of annotations) {
      if (kind === "b") html = `<strong>${html}</strong>`;
      else if (kind === "i") html = `<em>${html}</em>`;
      else if (kind === "s") html = `<s>${html}</s>`;
      else if (kind === "_") html = `<u>${html}</u>`;
      else if (kind === "c") html = `<code>${html}</code>`;
      else if (kind === "a" && arg) html = `<a href="${escapeHtml(arg)}">${html}</a>`;
      else if (kind === "h" && colorName(arg)) html = `<span class="highlight-${arg}">${html}</span>`;
    }
    return html;
  }).join("");
}

// 노션 원본 표 블록으로 표 HTML을 만듦 (노션 HTML은 칸 안 줄바꿈에서 행이 끊겨 칸이 다음 행으로 밀림)
export function notionTableHtml(table: NotionBlock, rows: NotionBlock[]): string {
  const columns = table.format?.table_block_column_order ?? [];
  const columnHeader = table.format?.table_block_column_header === true;
  const rowHeader = table.format?.table_block_row_header === true;
  const body = rows.map((row, rowIndex) => {
    const cells = columns.map((column, columnIndex) => {
      const tag = (columnHeader && rowIndex === 0) || (rowHeader && columnIndex === 0) ? "th" : "td";
      return `<${tag}>${richTextToHtml(row.properties?.[column])}</${tag}>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<table><tbody>${body.join("")}</tbody></table>`;
}

const CALLOUT_START = "⁣notion-callout-start:";
const CALLOUT_END = "⁣notion-callout-end⁣";

export function calloutStartMarker(index: number): string {
  return `${CALLOUT_START}${index}⁣`;
}

export function isCalloutEndMarker(text: string): boolean {
  return text === CALLOUT_END;
}

export function calloutMarkerIndex(text: string): number | undefined {
  const match = /^⁣notion-callout-start:(\d+)⁣$/.exec(text);
  return match ? Number(match[1]) : undefined;
}

function markerParagraph(doc: Document, text: string): HTMLParagraphElement {
  const p = doc.createElement("p");
  p.textContent = text;
  return p;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 노션 HTML을 고쳐 씀: 표는 원본 데이터로 다시 만들고, 글자로 들어온 <aside>…</aside>(콜아웃)는 시작·끝 표시 줄로 바꿈
export function prepareNotionHtml(html: string, blocks: NotionBlock[]): { html: string; callouts: NotionCallout[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const byId = new Map(blocks.map((block) => [block.id, block]));

  const tables = blocks.filter((block) => block.type === "table");
  const tableElements = Array.from(doc.body.querySelectorAll("table"));
  // 표 수가 같을 때만 순서대로 맞춰 바꿈 (다르면 잘못 짝지을 수 있어 노션 HTML을 그대로 씀)
  if (tables.length > 0 && tables.length === tableElements.length) {
    tables.forEach((table, index) => {
      const rows = (table.content ?? []).map((id) => byId.get(id)).filter((row): row is NotionBlock => row?.type === "table_row");
      const holder = doc.createElement("div");
      holder.innerHTML = notionTableHtml(table, rows);
      tableElements[index].replaceWith(holder.firstElementChild!);
    });
  }

  const calloutBlocks = blocks.filter((block) => block.type === "callout");
  const callouts: NotionCallout[] = calloutBlocks.map((block) => {
    const color = colorName(block.format?.block_color);
    const icon = block.format?.page_icon ?? "";
    return {
      // 이미지 아이콘(주소)은 옮길 수 없어 기본 아이콘
      icon: icon && !/[/:]/.test(icon) ? icon : "💡",
      backgroundColor: color?.background ? color.name : color ? "default" : "gray",
      textColor: color && !color.background ? color.name : "default",
    };
  });
  if (calloutBlocks.length > 0) {
    let started = 0;
    for (const element of Array.from(doc.body.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6"))) {
      let changed = false;
      if ((element.textContent ?? "").trim().startsWith("<aside>") && started < callouts.length) {
        const index = started++;
        element.before(markerParagraph(doc, calloutStartMarker(index)));
        // "<aside>" 글자와 다음 줄바꿈, 이어지는 아이콘(콜아웃 아이콘으로 옮김)을 글에서 뺌
        const icon = calloutBlocks[index].format?.page_icon;
        element.innerHTML = element.innerHTML.replace(/^\s*&lt;aside&gt;\s*(<br\s*\/?>)?\s*/, "");
        if (icon) element.innerHTML = element.innerHTML.replace(new RegExp(`^\\s*${escapeRegExp(icon)}\\s*(<br\\s*/?>)?\\s*`), "");
        changed = true;
      }
      if ((element.textContent ?? "").trim().endsWith("</aside>")) {
        element.innerHTML = element.innerHTML.replace(/\s*(<br\s*\/?>)?\s*&lt;\/aside&gt;\s*$/, "");
        element.after(markerParagraph(doc, CALLOUT_END));
        changed = true;
      }
      // 표시 글자만 있던 줄은 지움
      if (changed && !(element.textContent ?? "").trim() && !element.querySelector("img")) element.remove();
    }
  }
  return { html: doc.body.innerHTML, callouts };
}

interface FoldableBlock {
  type: string;
  content?: unknown;
  children?: FoldableBlock[];
  props?: Record<string, unknown>;
}

function markerText(block: FoldableBlock): string | undefined {
  if (block.type !== "paragraph" || !Array.isArray(block.content)) return undefined;
  return block.content.map((part: { text?: string }) => part.text ?? "").join("");
}

// 시작·끝 표시 줄 사이의 블록을 콜아웃 블록의 하위 블록으로 묶음 (중첩된 콜아웃·하위 블록 안도 처리)
export function foldCallouts<T extends FoldableBlock>(blocks: T[], callouts: NotionCallout[]): T[] {
  const result: T[] = [];
  const stack: { callout: T; parent: T[] }[] = [];
  let target = result;
  for (const block of blocks) {
    const text = markerText(block);
    const index = text === undefined ? undefined : calloutMarkerIndex(text);
    if (index !== undefined) {
      const info = callouts[index] ?? { icon: "💡", backgroundColor: "gray", textColor: "default" };
      const callout = { type: "callout", props: { ...info }, children: [] as T[] } as unknown as T;
      target.push(callout);
      stack.push({ callout, parent: target });
      target = callout.children as T[];
      continue;
    }
    if (text !== undefined && isCalloutEndMarker(text)) {
      const top = stack.pop();
      if (top) target = top.parent;
      continue;
    }
    const children = block.children?.length ? foldCallouts(block.children as T[], callouts) : block.children;
    target.push({ ...block, children } as T);
  }
  return result;
}
