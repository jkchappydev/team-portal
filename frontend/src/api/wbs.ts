import { apiFetch } from "./client";

export interface WbsAssigneeDto {
  id: number;
  name: string;
}

// WBS 표의 한 줄 (id가 null이면 전체 합계 줄), weight·planned·actual은 백분율(0~100)
export interface WbsRowDto {
  id: number | null;
  parentId: number | null;
  depth: number;
  hasChildren: boolean;
  name: string;
  assignees: WbsAssigneeDto[];
  // YYYY-MM-DD (없으면 null)
  startDate: string | null;
  endDate: string | null;
  workdays: number;
  calendarDays: number;
  weight: number;
  plannedTotal: number;
  actualTotal: number;
  plannedPercent: number;
  actualPercent: number;
}

export interface WbsHolidayDto {
  date: string;
  name: string;
}

// 표시 순서대로 펼친 작업 줄, 전체 합계, 간트 차트 날짜 범위와 그 범위의 공휴일
export interface WbsDto {
  documentId: number;
  baseDate: string;
  summary: WbsRowDto;
  tasks: WbsRowDto[];
  rangeStart: string;
  rangeEnd: string;
  holidays: WbsHolidayDto[];
}

// 작업 전체 값 (하위 작업이 있는 작업은 날짜·진척률을 비워서 보냄)
export interface WbsTaskInput {
  name: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  assigneeIds: number[];
}

export function getWbs(documentId: number, baseDate: string): Promise<WbsDto> {
  return apiFetch<WbsDto>(`/api/wbs/${documentId}?baseDate=${encodeURIComponent(baseDate)}`);
}

// parentId 아래 index 위치에 새 작업 (index가 없으면 맨 아래), 새 작업 ID 반환
export function createWbsTask(documentId: number, parentId: number | null, index?: number): Promise<number> {
  return apiFetch<number>(`/api/wbs/${documentId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ parentId, index }),
  });
}

export function updateWbsTask(taskId: number, input: WbsTaskInput): Promise<void> {
  return apiFetch<void>(`/api/wbs/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function moveWbsTask(taskId: number, parentId: number | null, index?: number): Promise<void> {
  return apiFetch<void>(`/api/wbs/tasks/${taskId}/position`, {
    method: "PATCH",
    body: JSON.stringify({ parentId, index }),
  });
}

export function deleteWbsTask(taskId: number): Promise<void> {
  return apiFetch<void>(`/api/wbs/tasks/${taskId}`, { method: "DELETE" });
}
