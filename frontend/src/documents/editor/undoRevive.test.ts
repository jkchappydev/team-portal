import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { reviveUndoManager } from "./undoRevive";

function setup() {
  const doc = new Y.Doc();
  const text = doc.getText("t");
  const origin = { name: "local" };
  const undoManager = new Y.UndoManager(text, { trackedOrigins: new Set([origin]) });
  const type = (value: string) => doc.transact(() => text.insert(text.length, value), origin);
  return { text, undoManager, type };
}

describe("reviveUndoManager", () => {
  it("편집 화면이 다시 붙으며 파괴된 되돌리기 관리자를 다시 연결해 Ctrl+Z가 동작한다", () => {
    const { text, undoManager, type } = setup();
    undoManager.destroy();
    type("파괴 후");
    expect(undoManager.undoStack).toHaveLength(0);

    expect(reviveUndoManager(undoManager)).toBe(true);
    type("다시 연결 후");
    undoManager.undo();
    expect(text.toString()).toBe("파괴 후");
  });

  it("살아 있는 관리자는 그대로 두어 변경이 두 번 기록되지 않는다", () => {
    const { text, undoManager, type } = setup();
    expect(reviveUndoManager(undoManager)).toBe(false);
    type("a");
    undoManager.stopCapturing();
    type("b");
    undoManager.undo();
    expect(text.toString()).toBe("a");
  });

  it("관리자가 없으면 아무것도 하지 않는다", () => {
    expect(reviveUndoManager(undefined)).toBe(false);
  });
});
