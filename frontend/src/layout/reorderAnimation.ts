import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

// 끌어서 순서를 바꾼 뒤 줄들이 새 위치로 미끄러지는 시간
const SLIDE_MS = 200;
// 끌기 시작 후 이 시간 안에 순서가 바뀌면 이동 효과 (서버 응답을 기다리는 시간 포함)
const ARMED_MS = 10_000;

interface Snapshot {
  order: string;
  tops: Map<string, number>;
  armedUntil: number;
}

// 운영체제의 "애니메이션 줄이기" 설정을 켠 사용자는 효과 없이 바로 이동
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// 목록 안 줄들의 위치 (목록 위쪽 기준이라 스크롤과 무관)
function measure(container: HTMLElement, selector: string): Omit<Snapshot, "armedUntil"> {
  const base = container.getBoundingClientRect().top;
  const tops = new Map<string, number>();
  container.querySelectorAll<HTMLElement>(selector).forEach((row) => {
    const id = row.dataset.flipId;
    if (id) tops.set(id, row.getBoundingClientRect().top - base);
  });
  return { order: [...tops.keys()].join(","), tops };
}

// 끌어서 순서를 바꾸면 자리가 바뀐 줄들이 이전 위치에서 새 위치로 미끄러지게 함
// 줄 요소에 data-flip-id를 달고, 목록을 감싸는 요소의 ref를 넘김
// 끌기로 바뀐 경우만 움직이고, 다른 사람의 수정 등으로 바뀐 순서는 그대로 표시
export function useReorderAnimation(containerRef: RefObject<HTMLElement | null>, selector = "[data-flip-id]") {
  const snapshot = useRef<Snapshot | null>(null);

  // 끌기 시작 시점의 위치를 기억 (목록이 나중에 그려져도 잡히도록 문서 전체에서 감시)
  useLayoutEffect(() => {
    const onDragStart = (event: DragEvent) => {
      const container = containerRef.current;
      if (!container || !(event.target instanceof Node) || !container.contains(event.target)) return;
      snapshot.current = { ...measure(container, selector), armedUntil: Date.now() + ARMED_MS };
    };
    document.addEventListener("dragstart", onDragStart, true);
    return () => document.removeEventListener("dragstart", onDragStart, true);
  }, [containerRef, selector]);

  // 화면을 그릴 때마다 순서를 비교해 바뀌었으면 이전 위치에서 출발
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const current = measure(container, selector);
    const previous = snapshot.current;
    if (!previous || previous.armedUntil < Date.now() || previous.order === current.order) {
      snapshot.current = { ...current, armedUntil: previous?.armedUntil ?? 0 };
      return;
    }
    snapshot.current = { ...current, armedUntil: 0 };
    if (prefersReducedMotion()) return;
    container.querySelectorAll<HTMLElement>(selector).forEach((row) => {
      const before = previous.tops.get(row.dataset.flipId ?? "");
      const after = current.tops.get(row.dataset.flipId ?? "");
      if (before === undefined || after === undefined || Math.abs(before - after) < 1) return;
      if (typeof row.animate !== "function") return;
      row.animate(
        [{ transform: `translateY(${before - after}px)` }, { transform: "translateY(0)" }],
        { duration: SLIDE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    });
  });
}

// 방금 만든 항목: 목록에 처음 나타날 때 잠깐 강조 (같은 항목을 보여주는 사이드바·하위 페이지 목록 공용)
const NEW_ITEM_MS = 5_000;
const newItems = new Map<string, number>();

export function markNewItem(id: string): void {
  newItems.set(id, Date.now());
}

export function isNewItem(id: string): boolean {
  const created = newItems.get(id);
  if (created === undefined) return false;
  if (Date.now() - created > NEW_ITEM_MS) {
    newItems.delete(id);
    return false;
  }
  return true;
}
