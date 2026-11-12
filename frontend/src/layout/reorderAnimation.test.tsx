import { useRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNewItem, markNewItem, useReorderAnimation } from "./reorderAnimation";

// 줄 높이 30px짜리 목록 (줄 위치는 화면 순서로 계산)
function List({ ids }: { ids: number[] }) {
  const ref = useRef<HTMLUListElement>(null);
  useReorderAnimation(ref);
  return (
    <ul ref={ref}>
      {ids.map((id) => <li key={id} data-flip-id={`row-${id}`} draggable>{`줄 ${id}`}</li>)}
    </ul>
  );
}

describe("useReorderAnimation", () => {
  const animate = vi.fn();

  beforeEach(() => {
    animate.mockClear();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.dataset.flipId ? Array.from(this.parentElement!.children).indexOf(this) : 0;
      return { top: index * 30 } as DOMRect;
    });
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("끌어서 순서를 바꾸면 자리가 바뀐 줄들이 이전 위치에서 출발해 새 위치로 이동한다", () => {
    const { rerender, getByText } = render(<List ids={[1, 2, 3]} />);
    fireEvent.dragStart(getByText("줄 3"));
    rerender(<List ids={[3, 1, 2]} />);

    // 맨 아래(60px)에서 맨 위(0px)로 올라간 줄은 60px 아래에서 출발
    const moves = animate.mock.calls.map(([frames]) => frames[0].transform);
    expect(moves).toEqual(["translateY(60px)", "translateY(-30px)", "translateY(-30px)"]);
  });

  it("끌기 없이 바뀐 순서(다른 사람의 수정 등)는 움직이지 않고 바로 표시한다", () => {
    const { rerender } = render(<List ids={[1, 2, 3]} />);
    rerender(<List ids={[3, 1, 2]} />);
    expect(animate).not.toHaveBeenCalled();
  });
});

describe("markNewItem", () => {
  it("방금 만든 항목만 새 항목으로 본다", () => {
    markNewItem("page-99");
    expect(isNewItem("page-99")).toBe(true);
    expect(isNewItem("page-98")).toBe(false);
  });

  it("만든 지 5초가 지나면 다시 그려져도 강조하지 않는다", () => {
    vi.useFakeTimers();
    markNewItem("page-77");
    vi.advanceTimersByTime(5_001);
    expect(isNewItem("page-77")).toBe(false);
    vi.useRealTimers();
  });
});
