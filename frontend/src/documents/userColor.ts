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

// 내 설정에서 고를 수 있는 프로필 색 (흰 글씨가 잘 보이는 진한 색)
export const PROFILE_COLORS = [
  "#e03131", "#c2255c", "#9c36b5", "#6741d9",
  "#3b5bdb", "#1971c2", "#0c8599", "#099268",
  "#2f9e44", "#f08c00", "#e8590c", "#495057",
] as const;

// 같은 사용자는 항상 같은 색, 8명 단위로 순환
export function userColor(userId: number): string {
  const index = ((userId % USER_COLORS.length) + USER_COLORS.length) % USER_COLORS.length;
  return USER_COLORS[index];
}
