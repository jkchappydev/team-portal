// 오늘 날짜 칸과 이번 달 열을 같은 연한 노란 배경으로 강조 (다크 모드는 어두운 배경에 맞춘 옅은 노랑)
export const CURRENT_HIGHLIGHT_BACKGROUND = "light-dark(#fffbdb, rgba(250, 204, 21, 0.12))";

// 보고 있는 연도가 올해면 이번 달(1~12), 아니면 null
export function currentMonthOf(year: number, now: Date = new Date()): number | null {
  return now.getFullYear() === year ? now.getMonth() + 1 : null;
}
