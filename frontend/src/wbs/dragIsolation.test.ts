import { afterEach, describe, expect, it, vi } from "vitest";
import type { DragEvent } from "react";
import { blockWbsDragOutside, stopWbsDragAtBoard, WBS_DRAG_TYPE } from "./dragIsolation";

// jsdom에는 DataTransfer가 없어 types만 가진 끌기 이벤트를 만듦
function dragEvent(type: string, types: string[]) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & { dataTransfer: { types: string[] } };
  Object.defineProperty(event, "dataTransfer", { value: { types } });
  return event;
}

describe("일정표 끌기 격리", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("일정표 줄 끌기는 일정표에서 멈춰 편집기로 올라가지 않는다", () => {
    const stop = vi.fn();
    stopWbsDragAtBoard({ dataTransfer: { types: [WBS_DRAG_TYPE] }, nativeEvent: { stopPropagation: stop } } as unknown as DragEvent);
    expect(stop).toHaveBeenCalled();
  });

  it("본문 블록 끌기 등 다른 끌기는 막지 않는다", () => {
    const stop = vi.fn();
    stopWbsDragAtBoard({ dataTransfer: { types: ["blocknote/html"] }, nativeEvent: { stopPropagation: stop } } as unknown as DragEvent);
    expect(stop).not.toHaveBeenCalled();
  });

  it("끄는 동안 일정표 밖에서는 아무도 반응하지 않고, 일정표 안과 끝난 뒤는 그대로 전달된다", () => {
    const board = document.body.appendChild(document.createElement("div"));
    const inside = board.appendChild(document.createElement("div"));
    const outside = document.body.appendChild(document.createElement("div"));
    const editorListener = vi.fn();
    document.body.addEventListener("dragover", editorListener);

    const release = blockWbsDragOutside(board);
    outside.dispatchEvent(dragEvent("dragover", [WBS_DRAG_TYPE]));
    expect(editorListener).not.toHaveBeenCalled();
    inside.dispatchEvent(dragEvent("dragover", [WBS_DRAG_TYPE]));
    expect(editorListener).toHaveBeenCalledTimes(1);

    release();
    outside.dispatchEvent(dragEvent("dragover", [WBS_DRAG_TYPE]));
    expect(editorListener).toHaveBeenCalledTimes(2);
  });
});
