import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { CURSOR_ACTIVE_MS, createCursorActivity, editingClientIds, renderCursor } from "./cursorActivity";

describe("editingClientIds", () => {
  it("글을 넣은 접속 ID만 돌려준다", () => {
    const doc = new Y.Doc();
    let captured: Uint8Array | null = null;
    doc.on("update", (update: Uint8Array) => { captured = update; });
    doc.getText("t").insert(0, "안녕");
    expect(editingClientIds(captured!)).toEqual([doc.clientID]);
  });

  it("다른 사람 글을 지우기만 한 경우 원래 글쓴이 이름을 띄우지 않는다", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.getText("t").insert(0, "abc");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    let captured: Uint8Array | null = null;
    b.on("update", (update: Uint8Array) => { captured = update; });
    b.getText("t").delete(0, 1);
    expect(editingClientIds(captured!)).not.toContain(a.clientID);
  });
});

describe("createCursorActivity", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("글을 고친 팀원의 커서에만 이름표를 띄우고 잠시 후 숨긴다", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const typing = renderCursor({ name: "한도윤", color: "#1971c2", memberId: 1 });
    const idle = renderCursor({ name: "이재구", color: "#e03131", memberId: 2 });
    container.append(typing, idle);
    document.body.append(container);
    const activity = createCursorActivity(container);

    activity.activate(1);

    expect(typing.hasAttribute("data-active")).toBe(true);
    expect(idle.hasAttribute("data-active")).toBe(false);
    vi.advanceTimersByTime(CURSOR_ACTIVE_MS);
    expect(typing.hasAttribute("data-active")).toBe(false);
    activity.dispose();
  });

  it("커서 요소에 팀원 이름과 팀원 번호를 싣는다", () => {
    const cursor = renderCursor({ name: "한도윤", color: "#1971c2", memberId: 7 });
    expect(cursor.dataset.memberId).toBe("7");
    expect(cursor.textContent).toContain("한도윤");
  });
});
