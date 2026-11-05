import { describe, expect, it } from "vitest";
import { childrenOf, descendantIds, groupByParent } from "./pageTree";

const page = (id: number, parentId: number | null) => ({ id, parentId, title: `p${id}` });

describe("pageTree", () => {
  it("상위 페이지별로 하위 페이지를 만든 순서대로 묶는다", () => {
    const groups = groupByParent([page(1, null), page(2, 1), page(3, null), page(4, 1)]);
    expect(childrenOf(groups, null).map((p) => p.id)).toEqual([1, 3]);
    expect(childrenOf(groups, 1).map((p) => p.id)).toEqual([2, 4]);
    expect(childrenOf(groups, 3)).toEqual([]);
  });

  it("페이지 아래의 모든 하위 페이지 ID를 모은다", () => {
    const groups = groupByParent([page(1, null), page(2, 1), page(3, 2), page(4, 1), page(5, null)]);
    expect([...descendantIds(groups, 1)].sort()).toEqual([2, 3, 4]);
    expect(descendantIds(groups, 5).size).toBe(0);
  });
});
