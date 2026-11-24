import { describe, expect, it } from "vitest";
import { isTypingTarget, undoAction } from "./undoAnywhere";

const key = (k: string, code: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key: k, code, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;

describe("undoAction", () => {
  it("Ctrl+Z는 되돌리기, Ctrl+Y·Ctrl+Shift+Z는 다시 실행", () => {
    expect(undoAction(key("z", "KeyZ"))).toBe("undo");
    expect(undoAction(key("y", "KeyY"))).toBe("redo");
    expect(undoAction(key("Z", "KeyZ", { shiftKey: true }))).toBe("redo");
    expect(undoAction(key("z", "KeyZ", { ctrlKey: false, metaKey: true }))).toBe("undo");
  });

  it("한글 입력 상태에서도 자판 위치로 판단한다", () => {
    expect(undoAction(key("ㅋ", "KeyZ"))).toBe("undo");
    expect(undoAction(key("Process", "KeyY"))).toBe("redo");
  });

  it("Ctrl 없이 누르거나 다른 키면 처리하지 않는다", () => {
    expect(undoAction(key("z", "KeyZ", { ctrlKey: false }))).toBeNull();
    expect(undoAction(key("c", "KeyC"))).toBeNull();
    expect(undoAction(key("z", "KeyZ", { altKey: true }))).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("입력 칸·편집 영역·대화 상자 안이면 그쪽 되돌리기에 맡긴다", () => {
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const inEditable = document.createElement("span");
    editable.appendChild(inEditable);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.appendChild(button);
    document.body.append(input, editable, dialog);
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(inEditable)).toBe(true);
    expect(isTypingTarget(button)).toBe(true);
    document.body.replaceChildren();
  });

  it("페이지 빈 곳·버튼이면 본문 되돌리기를 쓴다", () => {
    const button = document.createElement("button");
    document.body.append(button);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(button)).toBe(false);
    document.body.replaceChildren();
  });
});
