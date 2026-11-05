import { apiFetch } from "./client";

export type WorkStatusType = "LEAVE" | "HALF_DAY" | "QUARTER_DAY" | "BUSINESS_TRIP" | "OUTSIDE_WORK" | "OTHER";
export type HalfDayPeriod = "AM" | "PM";

export interface WorkStatusDto {
  id: number;
  memberId: number;
  memberName: string;
  type: WorkStatusType;
  startDate: string;
  endDate: string;
  halfDayPeriod: HalfDayPeriod | null;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
  content: string | null;
  label: string;
}

export interface WorkStatusRequest {
  memberId: number;
  type: WorkStatusType;
  startDate: string;
  endDate: string;
  halfDayPeriod: HalfDayPeriod | null;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
  content: string | null;
}

export function listWorkStatuses(year: number, month: number): Promise<WorkStatusDto[]> {
  return apiFetch<WorkStatusDto[]>(`/api/work-statuses?year=${year}&month=${month}`);
}

export function createWorkStatus(body: WorkStatusRequest): Promise<WorkStatusDto> {
  return apiFetch<WorkStatusDto>("/api/work-statuses", { method: "POST", body: JSON.stringify(body) });
}

export function updateWorkStatus(id: number, body: WorkStatusRequest): Promise<WorkStatusDto> {
  return apiFetch<WorkStatusDto>(`/api/work-statuses/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function deleteWorkStatus(id: number): Promise<void> {
  return apiFetch<void>(`/api/work-statuses/${id}`, { method: "DELETE" });
}
