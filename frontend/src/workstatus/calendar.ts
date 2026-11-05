import type { WorkStatusDto } from "../api/workStatuses";

export interface CalendarDay {
  date: string;
  inMonth: boolean;
  weekend: boolean;
}

const DAY_MS = 86_400_000;

// 타임존 영향을 피하려고 UTC 기준으로 날짜 문자열을 다룸
function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isWeekend(ms: number): boolean {
  const dow = new Date(ms).getUTCDay();
  return dow === 0 || dow === 6;
}

// 월요일 시작 주 단위 달력 격자 생성 (앞뒤 달 날짜는 inMonth=false)
export function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(year, month, 0);
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - offset * DAY_MS;
  const weekCount = Math.ceil((offset + (last - first) / DAY_MS + 1) / 7);

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = start + (w * 7 + d) * DAY_MS;
      week.push({ date: toDateString(ms), inMonth: ms >= first && ms <= last, weekend: isWeekend(ms) });
    }
    weeks.push(week);
  }
  return weeks;
}

// 기간 항목을 해당 월의 평일(월~금)에만 펼쳐 날짜별로 배치
export function expandToWeekdays(
  items: WorkStatusDto[],
  year: number,
  month: number,
): Map<string, WorkStatusDto[]> {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0);
  const result = new Map<string, WorkStatusDto[]>();

  for (const item of items) {
    const from = Math.max(toUtc(item.startDate), monthStart);
    const to = Math.min(toUtc(item.endDate), monthEnd);
    for (let ms = from; ms <= to; ms += DAY_MS) {
      if (isWeekend(ms)) continue;
      const key = toDateString(ms);
      const list = result.get(key);
      if (list) list.push(item);
      else result.set(key, [item]);
    }
  }
  return result;
}

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY_NAMES[d.getUTCDay()]})`;
}

// 연차 표의 월-주 칸이 가리키는 평일(월~금) 범위 라벨 (백엔드 LeaveWeek.weekOfMonth와 같은 주 계산)
export function leaveWeekRangeLabel(year: number, month: number, week: number): string | null {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0);
  let firstWeekday = monthStart;
  while (isWeekend(firstWeekday)) firstWeekday += DAY_MS;
  const firstMonday = firstWeekday - ((new Date(firstWeekday).getUTCDay() + 6) % 7) * DAY_MS;
  const monday = firstMonday + (week - 1) * 7 * DAY_MS;
  // 해당 달에 속한 월~금만 범위로 사용
  const from = Math.max(monday, monthStart);
  const to = Math.min(monday + 4 * DAY_MS, monthEnd);
  if (from > to) return null;
  return from === to ? formatShortDate(from) : `${formatShortDate(from)} ~ ${formatShortDate(to)}`;
}
