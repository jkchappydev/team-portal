import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPageRemovalTracker } from "./pageRemoval";
import type { PageRemovalActions } from "./pageRemoval";

function setup(referenced: number[] = [], cut: number[] = []) {
  const actions: PageRemovalActions = {
    referencedIds: () => new Set(referenced),
    isCut: (id) => cut.includes(id),
    trashPage: vi.fn(() => Promise.resolve()),
    restorePage: vi.fn(() => Promise.resolve()),
    onError: vi.fn(),
  };
  return { actions, tracker: createPageRemovalTracker(1, actions, 100) };
}

describe("createPageRemovalTracker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("지운 페이지 블록의 페이지를 잠시 뒤 휴지통으로 보낸다", () => {
    const { actions, tracker } = setup();
    tracker.removed([7]);
    expect(actions.trashPage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(actions.trashPage).toHaveBeenCalledWith(7);
  });

  it("본문에 아직 있거나(끌어 옮김) 잘라낸 페이지, 자기 자신은 휴지통으로 보내지 않는다", () => {
    const { actions, tracker } = setup([7], [8]);
    tracker.removed([7, 8, 1]);
    vi.advanceTimersByTime(100);
    expect(actions.trashPage).not.toHaveBeenCalled();
  });

  it("휴지통으로 보내기 전에 되돌리면 아무것도 하지 않고, 보낸 뒤 되돌리면 복원한다", () => {
    const { actions, tracker } = setup();
    tracker.removed([7]);
    tracker.restored([7]);
    vi.advanceTimersByTime(100);
    expect(actions.trashPage).not.toHaveBeenCalled();
    expect(actions.restorePage).not.toHaveBeenCalled();

    tracker.removed([9]);
    vi.advanceTimersByTime(100);
    tracker.restored([9]);
    expect(actions.restorePage).toHaveBeenCalledWith(9);
  });

  it("본문을 떠나면 기다리던 페이지를 바로 처리한다", () => {
    const { actions, tracker } = setup();
    tracker.removed([7]);
    tracker.dispose();
    expect(actions.trashPage).toHaveBeenCalledWith(7);
  });
});
