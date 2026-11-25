import { ko } from "@blocknote/core/locales";

// 블록 메뉴 "전환"으로 바꿀 수 있는 글 종류 (이름은 슬래시 메뉴와 같은 문구)
export type TurnIntoKey =
  | "paragraph" | "heading1" | "heading2" | "heading3" | "bulletListItem" | "numberedListItem"
  | "checkListItem" | "toggleListItem" | "codeBlock" | "quote" | "callout";

export interface TurnIntoOption {
  key: TurnIntoKey;
  label: string;
}

export const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  { key: "paragraph", label: ko.slash_menu.paragraph.title },
  { key: "heading1", label: ko.slash_menu.heading.title },
  { key: "heading2", label: ko.slash_menu.heading_2.title },
  { key: "heading3", label: ko.slash_menu.heading_3.title },
  { key: "bulletListItem", label: ko.slash_menu.bullet_list.title },
  { key: "numberedListItem", label: ko.slash_menu.numbered_list.title },
  { key: "checkListItem", label: ko.slash_menu.check_list.title },
  { key: "toggleListItem", label: ko.slash_menu.toggle_list.title },
  { key: "codeBlock", label: ko.slash_menu.code_block.title },
  { key: "quote", label: ko.slash_menu.quote.title },
  { key: "callout", label: "콜아웃" },
];

// 글이 들어 있는 블록 종류 (전환 메뉴를 보여 줄 블록)
const TEXT_TYPES = new Set(["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem", "codeBlock", "quote"]);

export interface TurnIntoBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: unknown;
  children: unknown[];
}

export type TurnIntoChange =
  | { kind: "update"; update: { type: string; props?: Record<string, unknown>; content?: unknown } }
  | { kind: "replace"; blocks: Record<string, unknown>[] };

export function canTurnInto(block: Pick<TurnIntoBlock, "type">): boolean {
  return TEXT_TYPES.has(block.type);
}

// 지금 블록 종류 (메뉴 체크 표시용, 접을 수 있는 제목·제목4 이하는 목록에 없어 null)
export function currentTurnIntoKey(block: Pick<TurnIntoBlock, "type" | "props">): TurnIntoKey | null {
  if (block.type === "heading") {
    if (block.props.isToggleable) return null;
    const level = Number(block.props.level);
    return level >= 1 && level <= 3 ? (`heading${level}` as TurnIntoKey) : null;
  }
  return TURN_INTO_OPTIONS.some((option) => option.key === block.type) ? (block.type as TurnIntoKey) : null;
}

// 글자 내용을 서식 없는 글로 (코드 블록은 서식·멘션을 담을 수 없음)
export function plainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item: { type?: string; text?: string; content?: unknown; props?: { name?: string } }) => {
    if (item.type === "text") return item.text ?? "";
    if (item.type === "link") return plainText(item.content);
    if (item.type === "mention") return `@${item.props?.name ?? ""}`;
    return "";
  }).join("");
}

// 블록을 다른 글 종류로 바꾸는 변경 (글은 그대로 두고 종류만 바꿈)
export function turnIntoChange(block: TurnIntoBlock, key: TurnIntoKey): TurnIntoChange {
  // 콜아웃은 글을 상자 안 하위 블록으로 담으므로 블록째 바꿈 (원래 하위 블록도 상자 안으로)
  if (key === "callout") {
    return {
      kind: "replace",
      blocks: [{ type: "callout", children: [{ type: "paragraph", content: block.content ?? [] }, ...block.children] }],
    };
  }
  if (key === "codeBlock") {
    return { kind: "update", update: { type: "codeBlock", content: plainText(block.content) } };
  }
  // 코드 블록에서 나올 때는 서식 없는 글 그대로
  const content = block.type === "codeBlock" ? plainText(block.content) : undefined;
  const update = key.startsWith("heading")
    ? { type: "heading", props: { level: Number(key.slice("heading".length)), isToggleable: false } }
    : { type: key };
  return { kind: "update", update: content === undefined ? update : { ...update, content } };
}
