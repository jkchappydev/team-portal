interface TreePage {
  id: number;
  parentId: number | null;
}

// 상위 페이지 ID(null = 프로젝트 최상위)별 하위 페이지 목록. 입력 순서(만든 순서) 유지
export function groupByParent<T extends TreePage>(pages: T[]): Map<number | null, T[]> {
  const groups = new Map<number | null, T[]>();
  for (const page of pages) {
    const list = groups.get(page.parentId) ?? [];
    list.push(page);
    groups.set(page.parentId, list);
  }
  return groups;
}

export function childrenOf<T extends TreePage>(groups: Map<number | null, T[]>, parentId: number | null): T[] {
  return groups.get(parentId) ?? [];
}

// 페이지 아래의 모든 하위 페이지 ID (자기 하위로 옮기는 것을 막는 데 사용)
export function descendantIds<T extends TreePage>(groups: Map<number | null, T[]>, id: number): Set<number> {
  const result = new Set<number>();
  const stack = [id];
  while (stack.length > 0) {
    for (const child of childrenOf(groups, stack.pop()!)) {
      if (!result.has(child.id)) {
        result.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return result;
}
