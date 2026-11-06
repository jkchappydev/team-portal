import { describe, expect, it } from "vitest";
import type { WbsRowDto } from "../api/wbs";
import { itemIdOfPath, itemPath } from "../documents/itemPath";
import { addDays, daysBetween, descendantIdsOf, dropTargetAt, ganttDays, monthSpans, todayString } from "./wbsTree";

function row(id: number, parentId: number | null, depth: number): WbsRowDto {
  return {
    id, parentId, depth, hasChildren: false, name: `작업${id}`, assignees: [], startDate: null, endDate: null,
    workdays: 0, calendarDays: 0, weight: 0, plannedTotal: 0, actualTotal: 0, plannedPercent: 0, actualPercent: 0,
  };
}

// 1 ─ 2 ─ 3
//   └ 4
// 5
const rows = [row(1, null, 0), row(2, 1, 1), row(3, 2, 2), row(4, 1, 1), row(5, null, 0)];

describe("wbsTree", () => {
  it("표시 순서에서 더 깊은 바로 아래 줄들을 하위 작업으로 본다", () => {
    expect([...descendantIdsOf(rows, 1)]).toEqual([2, 3, 4]);
    expect([...descendantIdsOf(rows, 2)]).toEqual([3]);
    expect(descendantIdsOf(rows, 5).size).toBe(0);
  });

  it("같은 줄 사이라도 마우스를 오른쪽으로 끌수록 윗줄의 하위로 들어간다", () => {
    // 5를 4 아래(끌던 5를 뺀 목록의 맨 뒤)에 놓을 때
    expect(dropTargetAt(rows, 5, 4, 0)).toMatchObject({ depth: 0, parentId: null, index: 1 });
    expect(dropTargetAt(rows, 5, 4, 1)).toMatchObject({ depth: 1, parentId: 1, index: 2 });
    expect(dropTargetAt(rows, 5, 4, 2)).toMatchObject({ depth: 2, parentId: 4, index: 0 });
    // 윗줄의 바로 아래 단계보다 깊게는 들어가지 않음
    expect(dropTargetAt(rows, 5, 4, 9)).toMatchObject({ depth: 2, parentId: 4 });
  });

  it("아랫줄보다 얕은 단계로는 꺼낼 수 없어 트리 순서가 깨지지 않는다", () => {
    // 3을 2와 4 사이에 놓으면 둘 다 1단계라 왼쪽으로 끌어도 1의 하위
    expect(dropTargetAt(rows, 3, 2, 0)).toMatchObject({ depth: 1, parentId: 1, index: 1 });
  });

  it("끌던 작업과 그 하위를 뺀 목록 기준으로 위치를 정한다", () => {
    // 1을 끌면 1~4가 함께 움직여 남은 5 앞이 맨 앞
    expect(dropTargetAt(rows, 1, 0, 3)).toMatchObject({ slot: 0, depth: 0, parentId: null, index: 0 });
  });

  it("간트 날짜 칸은 토·일·공휴일을 쉬는 날로 표시한다", () => {
    const days = ganttDays("2023-06-02", "2023-06-06", [{ date: "2023-06-06", name: "현충일" }]);
    expect(days.map((d) => d.day)).toEqual([2, 3, 4, 5, 6]);
    expect(days.map((d) => d.off)).toEqual([false, true, true, false, true]);
    expect(days[4].holidayName).toBe("현충일");
  });

  it("간트 머리글 윗줄은 연월별로 칸을 묶는다", () => {
    const spans = monthSpans(ganttDays("2023-05-30", "2023-06-02", []));
    expect(spans).toEqual([{ label: "2023년 05월", count: 2 }, { label: "2023년 06월", count: 2 }]);
  });

  it("날짜 차이를 시간대와 상관없이 일 단위로 계산한다", () => {
    expect(daysBetween("2023-05-12", "2023-07-28")).toBe(77);
    expect(daysBetween("2023-03-25", "2023-03-27")).toBe(2);
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
    expect(todayString(new Date(2026, 10, 6, 23, 59))).toBe("2026-11-06");
  });

  it("항목 종류별 화면 주소를 만들고 주소에서 항목 ID를 읽는다", () => {
    expect(itemPath("WBS", 3)).toBe("/wbs/3");
    expect(itemPath("FILE", 3)).toBe("/files/3");
    expect(itemPath("PAGE", 3)).toBe("/documents/3");
    expect(itemIdOfPath("/wbs/12")).toBe(12);
    expect(itemIdOfPath("/members")).toBeNull();
  });
});
