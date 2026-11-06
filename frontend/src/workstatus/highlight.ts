// 오늘 날짜 칸과 이번 달 열을 같은 배경으로 강조 (라이트 모드는 연한 노랑, 다크 모드는 노랑이 회색 위에서 탁해 보여 옅은 파랑)
export const CURRENT_HIGHLIGHT_BACKGROUND = "light-dark(#fffbdb, rgba(34, 139, 230, 0.16))";

// 보고 있는 연도가 올해면 이번 달(1~12), 아니면 null
export function currentMonthOf(year: number, now: Date = new Date()): number | null {
  return now.getFullYear() === year ? now.getMonth() + 1 : null;
}
