import { describe, expect, it, vi } from "vitest";
import { placeScheduleBlock } from "./scheduleCommand";
import type { ScheduleEditor } from "./scheduleCommand";

function fakeEditor(existingIds: string[]): ScheduleEditor {
  return {
    getBlock: (id: string) => (existingIds.includes(id) ? { id } : undefined),
    updateBlock: vi.fn(),
    insertBlocks: vi.fn(),
    document: existingIds.map((id) => ({ id })),
  };
}

const schedule = { type: "schedule", props: { documentId: 9 } };

describe("placeScheduleBlock", () => {
  it("빈 줄에서 /일정을 고르면 그 줄을 일정 블록으로 바꾼다", () => {
    const editor = fakeEditor(["a", "b"]);
    placeScheduleBlock(editor, { id: "b", content: [] }, 9);
    expect(editor.updateBlock).toHaveBeenCalledWith({ id: "b", content: [] }, schedule);
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });

  it("글자가 있는 줄이면 그 아래에 넣는다", () => {
    const editor = fakeEditor(["a"]);
    const block = { id: "a", content: [{ type: "text", text: "회의" }] };
    placeScheduleBlock(editor, block, 9);
    expect(editor.insertBlocks).toHaveBeenCalledWith([schedule], block, "after");
  });

  it("WBS를 만드는 동안 그 줄이 지워졌으면 본문 맨 끝에 넣는다", () => {
    const editor = fakeEditor(["a", "c"]);
    placeScheduleBlock(editor, { id: "gone", content: [] }, 9);
    expect(editor.insertBlocks).toHaveBeenCalledWith([schedule], { id: "c" }, "after");
  });
});
