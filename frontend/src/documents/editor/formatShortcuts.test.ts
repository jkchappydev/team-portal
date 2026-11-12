import { describe, expect, it, vi } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { clearFormatting, formatShortcutsExtension, shortcutLabel } from "./formatShortcuts";
import { editorSchema } from "./schema";

describe("clearFormatting", () => {
  it("링크를 뺀 굵게·기울임·밑줄·취소선·코드·글자색·배경색을 지운다", () => {
    const removeStyles = vi.fn();
    clearFormatting({ removeStyles });
    expect(Object.keys(removeStyles.mock.calls[0][0]).sort())
      .toEqual(["backgroundColor", "bold", "code", "italic", "strike", "textColor", "underline"]);
  });
});

describe("formatShortcutsExtension", () => {
  // 실제 편집기에 키를 눌러 편집기가 가로챘는지(기본 동작 막음) 확인
  const press = (key: string, shift: boolean) => {
    const editor = BlockNoteEditor.create({ schema: editorSchema, extensions: [formatShortcutsExtension] });
    const host = document.createElement("div");
    document.body.appendChild(host);
    editor.mount(host);
    const event = new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: shift, bubbles: true, cancelable: true });
    editor.prosemirrorView!.dom.dispatchEvent(event);
    editor.unmount();
    host.remove();
    return event.defaultPrevented;
  };

  it("서식 지우기(Ctrl+역슬래시)는 편집기가 처리한다", () => {
    expect(press("\\", false)).toBe(true);
  });

  it("브라우저 단축키와 겹치는 Ctrl+Shift+R(강력 새로고침)·L·E는 편집기가 막지 않는다", () => {
    expect(press("R", true)).toBe(false);
    expect(press("L", true)).toBe(false);
    expect(press("E", true)).toBe(false);
  });
});

describe("shortcutLabel", () => {
  it("Windows에서는 Mod를 Ctrl로 보여준다", () => {
    expect(shortcutLabel("Mod+Shift+L")).toBe("Ctrl+Shift+L");
  });
});
