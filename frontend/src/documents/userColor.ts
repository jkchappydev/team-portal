// 협업 커서 표시용 고정 팔레트 8색
export const USER_COLORS = [
  "#e03131",
  "#1971c2",
  "#2f9e44",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#c2255c",
  "#5f3dc4",
] as const;

// 같은 사용자는 항상 같은 색, 8명 단위로 순환
export function userColor(userId: number): string {
  const index = ((userId % USER_COLORS.length) + USER_COLORS.length) % USER_COLORS.length;
  return USER_COLORS[index];
}
