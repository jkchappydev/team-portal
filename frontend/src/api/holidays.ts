import { apiFetch } from "./client";

export interface HolidayDto {
  date: string;
  name: string;
}

export function listHolidays(year: number, month: number): Promise<HolidayDto[]> {
  return apiFetch<HolidayDto[]>(`/api/holidays?year=${year}&month=${month}`);
}
