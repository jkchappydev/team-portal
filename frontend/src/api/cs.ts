import { apiFetch } from "./client";

// CS 상태 코드 (REQS 요청, PROG 진행중, FEED 피드백, COMP 완료, HOLD 보류)
export type CsStatus = "REQS" | "PROG" | "FEED" | "COMP" | "HOLD";

export interface NewCsDto {
  id: number;
  title: string;
  groupName: string | null;
  requesterName: string | null;
  // 미지정이면 null
  managerName: string | null;
  status: CsStatus | string;
  statusName: string | null;
  createdAt: string | null;
  detailUrl: string;
}

export interface NewCsListDto {
  // CS 시스템 연동 설정 여부 (미설정이면 items는 빈 목록)
  configured: boolean;
  items: NewCsDto[];
}

// CS 시스템의 최근 등록 CS 10건 (전체 상태)
export function listNewCs(): Promise<NewCsListDto> {
  return apiFetch<NewCsListDto>("/api/cs/new");
}
