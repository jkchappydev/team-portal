import { createExtension, formatKeyboardShortcut } from "@blocknote/core";
import type { Extension } from "@blocknote/core";

// 단축키 처리 함수가 받는 편집기
type ShortcutEditor = Parameters<NonNullable<Extension["keyboardShortcuts"]>[string]>[0]["editor"];

// 서식 도구 막대 버튼에 붙이는 단축키
// 정렬은 노션처럼 단축키 없이 버튼으로만 (Ctrl+Shift+R 강력 새로고침 등 브라우저 단축키와 겹침)
export const FORMAT_SHORTCUTS = {
  code: "Mod+E",
  clearFormatting: "Mod+\\",
} as const;

// 툴팁에 보이는 단축키 문구 (Windows는 Ctrl, Mac은 ⌘)
export function shortcutLabel(shortcut: string): string {
  return formatKeyboardShortcut(shortcut, "Ctrl");
}

// 서식 지우기로 걷어 내는 글자 서식 (링크는 서식이 아니라 남김)
const CLEARABLE_STYLES = ["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor"];

// 선택한 글자의 굵게·기울임·밑줄·취소선·코드·색을 한 번에 지움
export function clearFormatting(editor: Pick<ShortcutEditor, "removeStyles">): void {
  editor.removeStyles(Object.fromEntries(CLEARABLE_STYLES.map((style) => [style, true])));
}

// 키 이름은 ProseMirror 형식 (Mod = Windows Ctrl, Mac ⌘)
export const formatShortcutsExtension = createExtension({
  key: "formatShortcuts",
  keyboardShortcuts: {
    "Mod-\\": ({ editor }) => {
      clearFormatting(editor);
      return true;
    },
  },
});
