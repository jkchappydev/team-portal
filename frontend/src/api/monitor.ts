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
  // 서버 운영체제 이름 (예: Rocky Linux 8.10 (Green Obsidian))
  osName: string | null;
  // 리눅스 커널 버전 (리눅스가 아니면 null)
  kernel: string | null;
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
