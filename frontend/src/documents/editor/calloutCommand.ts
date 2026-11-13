// 슬래시 메뉴 "/콜아웃" 항목을 인용 바로 아래에 끼워 넣음 (인용이 없으면 맨 끝)
export function withCalloutItem<T extends { title: string }>(items: T[], callout: T, quoteTitle: string): T[] {
  const quoteIndex = items.findIndex((item) => item.title === quoteTitle);
  if (quoteIndex < 0) return [...items, callout];
  return [...items.slice(0, quoteIndex + 1), callout, ...items.slice(quoteIndex + 1)];
}

// 새 콜아웃은 안에 빈 줄 하나를 담아 만듦 (커서를 그 줄로 옮겨 바로 입력)
// 빈 줄을 콜아웃으로 바꿀 때 그 줄의 배경 없음(default)이 넘어오지 않도록 회색 배경을 지정
export const NEW_CALLOUT = {
  type: "callout" as const,
  props: { backgroundColor: "gray" as const },
  children: [{ type: "paragraph" as const }],
};

// 커서 위치 조상 노드 이름 (ProseMirror 트랜잭션 선택 기준)
interface SelectionLike {
  selection: { $from: { depth: number; node: (depth: number) => { type: { name: string } } } };
}

// 표 칸 안에서는 슬래시 메뉴를 열지 않음 (칸에는 블록을 넣을 수 없어 고른 블록이 표 밖에 생김, "/"는 글자로 입력)
export function isOutsideTable(tr: SelectionLike): boolean {
  const { $from } = tr.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "table") return false;
  }
  return true;
}
