import { apiFetch } from "./client";

export interface NewCsDto {
  id: number;
  title: string;
  groupName: string | null;
  requesterName: string | null;
  createdAt: string | null;
  detailUrl: string;
}

export interface NewCsListDto {
  // CS 시스템 연동 설정 여부 (미설정이면 items는 빈 목록)
  configured: boolean;
  items: NewCsDto[];
}

// CS 시스템의 요청 상태 CS 최신 10건
export function listNewCs(): Promise<NewCsListDto> {
  return apiFetch<NewCsListDto>("/api/cs/new");
}
