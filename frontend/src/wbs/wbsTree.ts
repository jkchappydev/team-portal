import type { WbsRowDto } from "../api/wbs";

// 같은 상위 아래 작업들 (표시 순서)
export function siblingsOf(rows: WbsRowDto[], parentId: number | null): WbsRowDto[] {
  return rows.filter((row) => row.parentId === parentId);
}

// 표시 순서 목록에서 이 줄 바로 아래 더 깊은 줄들이 하위 작업
export function descendantIdsOf(rows: WbsRowDto[], id: number): Set<number> {
  const result = new Set<number>();
  const start = rows.findIndex((row) => row.id === id);
  if (start === -1) return result;
  for (let i = start + 1; i < rows.length && rows[i].depth > rows[start].depth; i++) {
    if (rows[i].id !== null) result.add(rows[i].id as number);
  }
  return result;
}

export interface WbsDropTarget {
  // 끌던 작업과 그 하위를 뺀 목록에서의 줄 사이 위치 (0 = 맨 앞)
  slot: number;
  // 놓일 단계 (0 = 최상위), 가로선 들여쓰기에 사용
  depth: number;
  parentId: number | null;
  index: number;
}

// 노션식 끌기: 줄 사이 위치(slot)와 마우스 가로 위치로 원하는 단계(wantedDepth)를 받아 새 상위와 순서를 정함
// 단계는 바로 윗줄의 하위(윗줄 단계 + 1)부터 바로 아랫줄 단계까지만 허용해 트리 순서가 깨지지 않게 함
export function dropTargetAt(rows: WbsRowDto[], draggedId: number, slot: number, wantedDepth: number): WbsDropTarget {
  const moving = descendantIdsOf(rows, draggedId).add(draggedId);
  const rest = rows.filter((row) => row.id !== null && !moving.has(row.id as number));
  const position = Math.max(0, Math.min(slot, rest.length));
  const above = position > 0 ? rest[position - 1] : undefined;
  const below = rest[position];
  const maxDepth = above ? above.depth + 1 : 0;
  const minDepth = Math.min(below ? below.depth : 0, maxDepth);
  const depth = Math.max(minDepth, Math.min(maxDepth, Math.round(wantedDepth)));
  if (!above) return { slot: position, depth: 0, parentId: null, index: 0 };
  // 윗줄의 하위로 들어가면 그 첫 하위
  if (depth === above.depth + 1) return { slot: position, depth, parentId: above.id, index: 0 };
  // 같은 단계의 바로 앞 형제를 윗줄의 상위 경로에서 찾아 그 뒤에 넣음
  let previous: WbsRowDto | undefined = above;
  while (previous && previous.depth > depth) {
    const parentId: number | null = previous.parentId;
    previous = rest.find((row) => row.id === parentId);
  }
  const parentId = previous ? previous.parentId : null;
  const siblings = siblingsOf(rest, parentId);
  const index = previous ? siblings.findIndex((row) => row.id === previous!.id) + 1 : 0;
  return { slot: position, depth, parentId, index };
}

// YYYY-MM-DD 문자열을 시간대 영향 없이 UTC 자정 날짜로 변환
function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 두 날짜 사이 일 수 (to - from)
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

// date에서 days일 뒤 (YYYY-MM-DD)
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface GanttDay {
  date: string;
  day: number;
  month: number;
  year: number;
  // 토·일 또는 공휴일
  off: boolean;
  holidayName: string | null;
}

// 간트 차트의 날짜 칸 목록 (양 끝 포함)
export function ganttDays(rangeStart: string, rangeEnd: string, holidays: { date: string; name: string }[]): GanttDay[] {
  const names = new Map(holidays.map((h) => [h.date, h.name]));
  const result: GanttDay[] = [];
  const total = daysBetween(rangeStart, rangeEnd);
  for (let i = 0; i <= total; i++) {
    const d = new Date(toUtc(rangeStart) + i * DAY_MS);
    const date = d.toISOString().slice(0, 10);
    const weekday = d.getUTCDay();
    const holidayName = names.get(date) ?? null;
    result.push({
      date,
      day: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      year: d.getUTCFullYear(),
      off: weekday === 0 || weekday === 6 || holidayName !== null,
      holidayName,
    });
  }
  return result;
}

// 간트 머리글 윗줄: 같은 연월이 이어지는 칸 묶음
export function monthSpans(days: GanttDay[]): { label: string; count: number }[] {
  const spans: { label: string; count: number }[] = [];
  for (const day of days) {
    const label = `${day.year}년 ${String(day.month).padStart(2, "0")}월`;
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.count++;
    else spans.push({ label, count: 1 });
  }
  return spans;
}

// 소수 첫째 자리 백분율 표시
export function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// 브라우저 기준 오늘 (YYYY-MM-DD)
export function todayString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
