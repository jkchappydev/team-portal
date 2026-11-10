import { apiFetch } from "./client";

// 연차를 쓴 하루 (label 예: 연차, 오전 반차)
export interface LeaveUsageDayDto {
  date: string;
  label: string;
}

export interface WeeklyLeaveUsageDto {
  month: number;
  week: number;
  days: number;
  // 그 주에 연차를 쓴 날짜 (날짜순)
  dates?: LeaveUsageDayDto[];
}

export interface AnnualLeaveSummaryDto {
  memberId: number;
  memberName: string;
  confirmedDays: number;
  carriedDays: number;
  totalDays: number;
  usedDays: number;
  // 연차에서 빼지 않는 팀자율연차 일수 (합계·잔여와 별도)
  teamLeaveDays?: number;
  remainingDays: number;
  weeklyUsages: WeeklyLeaveUsageDto[];
  // 비활성·삭제(퇴사) 팀원은 이월·확정 연차를 고칠 수 없음
  editable: boolean;
}

export interface AnnualLeaveBalanceRequest {
  confirmedDays: number;
  carriedDays: number;
}

export function listAnnualLeaves(year: number): Promise<AnnualLeaveSummaryDto[]> {
  return apiFetch<AnnualLeaveSummaryDto[]>(`/api/annual-leaves?year=${year}`);
}

export function updateAnnualLeave(
  memberId: number,
  year: number,
  body: AnnualLeaveBalanceRequest,
): Promise<AnnualLeaveSummaryDto> {
  return apiFetch<AnnualLeaveSummaryDto>(`/api/annual-leaves/${memberId}?year=${year}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
