// 오늘 날짜 칸과 이번 달 열을 같은 배경으로 강조 (라이트 모드는 연한 노랑, 다크 모드는 노랑이 회색 위에서 탁해 보여 옅은 파랑)
export const CURRENT_HIGHLIGHT_BACKGROUND = "light-dark(#fffbdb, rgba(34, 139, 230, 0.16))";

// 보고 있는 연도가 올해면 이번 달(1~12), 아니면 null
export function currentMonthOf(year: number, now: Date = new Date()): number | null {
  return now.getFullYear() === year ? now.getMonth() + 1 : null;
}

// 보고 있는 연도가 올해면 오늘이 속한 연차 표 칸(월·주), 아니면 null
// 주 번호는 백엔드 LeaveWeek.weekOfMonth와 같은 규칙 (월요일 시작, 그 달 평일이 처음 나오는 주가 1주)
export function currentWeekOf(year: number, now: Date = new Date()): { month: number; week: number } | null {
  if (now.getFullYear() !== year) return null;
  const month = now.getMonth() + 1;
  const firstWeekday = new Date(year, month - 1, 1);
  while (firstWeekday.getDay() === 0 || firstWeekday.getDay() === 6) firstWeekday.setDate(firstWeekday.getDate() + 1);
  const mondayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  const days = Math.round((mondayOf(now).getTime() - mondayOf(firstWeekday).getTime()) / 86_400_000);
  return { month, week: Math.max(1, Math.floor(days / 7) + 1) };
}
