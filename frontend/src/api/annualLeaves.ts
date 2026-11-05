import { apiFetch } from "./client";

export interface WeeklyLeaveUsageDto {
  month: number;
  week: number;
  days: number;
}

export interface AnnualLeaveSummaryDto {
  memberId: number;
  memberName: string;
  confirmedDays: number;
  carriedDays: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  weeklyUsages: WeeklyLeaveUsageDto[];
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
