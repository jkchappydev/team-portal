import { defaultBlockSpecs } from "@blocknote/core";

const baseToggle = defaultBlockSpecs.toggleListItem;
type KeyboardOption = (block: unknown) => Record<string, unknown>;
const baseKeyboard = (baseToggle.implementation as { experimental_keyboard?: KeyboardOption }).experimental_keyboard;

// 노션처럼 토글 제목에서 Enter를 누르면 펼침 여부와 상관없이 아래에 새 토글을 만들고 안의 블록은 원래 토글에 남김
// 기본 동작은 펼친 토글이면 Enter가 안쪽 첫 줄을 만듦 (빈 제목에서 Enter로 일반 글줄이 되는 동작은 그대로)
export const toggleListItemSpec: typeof baseToggle = {
  ...baseToggle,
  implementation: {
    ...baseToggle.implementation,
    experimental_keyboard: (block: unknown) => ({ ...baseKeyboard?.(block), enter: "split", splitKeepsChildren: true }),
  } as typeof baseToggle.implementation,
};
