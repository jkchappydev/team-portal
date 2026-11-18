import { describe, expect, it, vi } from "vitest";
import { focusTitleState, openCreatedPage, shouldFocusTitle } from "./titleFocus";

describe("titleFocus", () => {
  it("새로 만든 그 페이지에서만 제목에 포커스를 준다", () => {
    const { state } = focusTitleState(7);
    expect(shouldFocusTitle(state, 7)).toBe(true);
    expect(shouldFocusTitle(state, 8)).toBe(false);
    expect(shouldFocusTitle(null, 7)).toBe(false);
    expect(shouldFocusTitle(undefined, 7)).toBe(false);
  });
});

describe("openCreatedPage", () => {
  it("페이지 블록 저장을 기다린 뒤 만든 페이지로 이동하며 제목 칸 포커스 상태를 넘긴다", async () => {
    let saved!: () => void;
    const waitSaved = () => new Promise<void>((resolve) => { saved = resolve; });
    const navigate = vi.fn();
    const done = openCreatedPage(waitSaved, navigate, 77);

    await Promise.resolve();
    expect(navigate).not.toHaveBeenCalled();
    saved();
    await done;
    expect(navigate).toHaveBeenCalledWith("/documents/77", { state: { focusTitle: 77 } });
    expect(shouldFocusTitle(navigate.mock.calls[0][1].state, 77)).toBe(true);
  });

  it("저장 확인이 실패해도 이동한다", async () => {
    const navigate = vi.fn();
    await openCreatedPage(() => Promise.reject(new Error("변경 내용을 서버에 저장하지 못했습니다.")), navigate, 5);
    expect(navigate).toHaveBeenCalledWith("/documents/5", { state: { focusTitle: 5 } });
  });
});
