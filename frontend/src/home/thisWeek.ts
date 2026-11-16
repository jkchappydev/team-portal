import type { WorkStatusDto } from "../api/workStatuses";
import { TYPE_ORDER } from "../workstatus/types";

export interface WeekDay {
  // YYYY-MM-DD
  date: string;
  year: number;
  month: number;
  day: number;
  // 0=월 … 4=금
  weekday: number;
}

const WEEKDAY_NAMES = ["월", "화", "수", "목", "금"];

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 오늘이 속한 주의 월~금 (근무 상황표 달력과 같이 일요일 시작이라 일요일에는 다가오는 주, 토요일에는 지난 월~금)
export function thisWeekDays(now: Date = new Date()): WeekDay[] {
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 1 + i);
    return { date: isoDate(d), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), weekday: i };
  });
}

// "11/16 (월)"
export function weekDayLabel(day: WeekDay): string {
  return `${day.month}/${day.day} (${WEEKDAY_NAMES[day.weekday]})`;
}

// 이번 주가 걸친 달 (월말·월초 주는 두 달)
export function monthsOf(days: WeekDay[]): { year: number; month: number }[] {
  const seen = new Map<string, { year: number; month: number }>();
  days.forEach((d) => seen.set(`${d.year}-${d.month}`, { year: d.year, month: d.month }));
  return [...seen.values()];
}

// 날짜별 근무 상황 항목 (근무 상황표와 같은 종류 순서, 여러 날짜에 걸친 항목은 그 기간의 날마다, 같은 항목이 두 달 조회에 겹쳐도 한 번만)
export function statusesByDay(days: WeekDay[], statuses: WorkStatusDto[]): Map<string, WorkStatusDto[]> {
  const unique = new Map<number, WorkStatusDto>();
  statuses.forEach((s) => unique.set(s.id, s));
  const result = new Map<string, WorkStatusDto[]>();
  days.forEach((day) => {
    result.set(day.date, [...unique.values()]
      .filter((s) => s.startDate <= day.date && day.date <= s.endDate)
      .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
        || a.memberName.localeCompare(b.memberName, "ko")));
  });
  return result;
}
