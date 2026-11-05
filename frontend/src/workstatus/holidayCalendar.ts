import type { HolidayDto } from "../api/holidays";

export function groupHolidaysByDate(items: HolidayDto[]): Map<string, HolidayDto[]> {
  const result = new Map<string, HolidayDto[]>();
  for (const item of items) {
    const holidays = result.get(item.date);
    if (holidays) holidays.push(item);
    else result.set(item.date, [item]);
  }
  return result;
}
