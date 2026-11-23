import { apiFetch } from "./client";

export interface ServerDiskDto {
  name: string;
  usedBytes: number;
  totalBytes: number;
}

// 포털 서버 자원 (읽을 수 없는 값은 null, available이 false면 서버 정보를 못 읽음)
export interface ServerStatusDto {
  available: boolean;
  serverName: string;
  // 첫 측정 직후에는 null
  cpuPercent: number | null;
  cpuCores: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  uptimeSeconds: number | null;
  disks: ServerDiskDto[];
  checkedAt: string;
}

export function getServerStatus(): Promise<ServerStatusDto> {
  return apiFetch<ServerStatusDto>("/api/monitor/server");
}
