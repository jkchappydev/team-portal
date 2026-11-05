// before/after: 줄 위·아래에 가로선을 그어 형제로 끼워 넣기, inside: 그 페이지의 하위로 넣기
export type DropPosition = "before" | "after" | "inside";

// 줄 높이의 위 30%는 앞, 아래 30%는 뒤, 가운데는 안쪽
// 형제 끼워 넣기를 막은 줄(최상위 페이지)은 항상 안쪽, 안쪽을 막은 줄(파일)은 위 절반 앞·아래 절반 뒤
export function dropPositionAt(offsetY: number, height: number, siblingDrop: boolean, insideDrop = true): DropPosition {
  if (!siblingDrop || height <= 0) return insideDrop ? "inside" : "after";
  if (!insideDrop) return offsetY < height / 2 ? "before" : "after";
  if (offsetY < height * 0.3) return "before";
  if (offsetY > height * 0.7) return "after";
  return "inside";
}
