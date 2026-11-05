// 세로 목록에서 커서 높이에 가장 가까운 줄 사이 위치(0 = 맨 앞, rows.length = 맨 뒤)
// 줄 가운데보다 위면 그 줄 앞, 모든 줄 가운데보다 아래면 맨 뒤라서 목록 위·아래 바깥까지 넓게 잡힘
export function dropSlotAt(clientY: number, rows: { top: number; height: number }[]): number {
  const index = rows.findIndex((row) => clientY < row.top + row.height / 2);
  return index === -1 ? rows.length : index;
}

// 끌던 줄을 뺀 목록 기준의 끼워 넣을 순서 (제자리면 null)
export function moveIndexOf(slot: number, draggedIndex: number): number | null {
  if (slot === draggedIndex || slot === draggedIndex + 1) return null;
  return slot > draggedIndex ? slot - 1 : slot;
}
