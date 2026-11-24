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
  // 서버 밖과 주고받는 초당 바이트 (첫 측정 직후나 읽을 수 없으면 null)
  networkRxBytesPerSec: number | null;
  networkTxBytesPerSec: number | null;
  checkedAt: string;
}

// 포털 서버를 맨 앞에, 그 뒤로 다른 운영 서버들 (다른 서버는 백엔드가 5초마다 읽어 둔 값)
export function getServerStatuses(): Promise<ServerStatusDto[]> {
  return apiFetch<ServerStatusDto[]>("/api/monitor/servers");
}

// 주소 호출(HTTP) 또는 포트 연결(TCP) 결과
export interface ServiceCheckDto {
  // 어느 운영 서버 것인지 (서버 이름 또는 IP, null이면 포털 서버)
  server: string | null;
  name: string;
  target: string;
  kind: "HTTP" | "TCP";
  up: boolean;
  // HTTP일 때만
  statusCode: number | null;
  responseMs: number | null;
  message: string | null;
}

// 포털 DB에 직접 쿼리한 결과
export interface PortalDatabaseDto {
  up: boolean;
  version: string | null;
  responseMs: number | null;
  connections: number | null;
  sizeBytes: number | null;
  message: string | null;
}

// 애플리케이션·DB 동작 상태 (백엔드가 30초마다 확인한 마지막 결과, 확인 전이면 checkedAt null)
export interface ServiceStatusDto {
  checkedAt: string | null;
  portalDatabase: PortalDatabaseDto | null;
  apps: ServiceCheckDto[];
  databases: ServiceCheckDto[];
}

export function getServiceStatus(): Promise<ServiceStatusDto> {
  return apiFetch<ServiceStatusDto>("/api/monitor/services");
}

export type HistoryRange = "1h" | "6h" | "24h" | "7d";

// 사용 기록 한 구간의 평균 (at: 구간 시작 시각, 값이 없던 항목은 null)
export interface HistoryPointDto {
  at: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
  rxBytesPerSec: number | null;
  txBytesPerSec: number | null;
}

// 서버 하나의 사용 기록: from~to를 bucketSeconds 간격으로 묶은 점들 (기록이 없는 구간은 빠짐)
export interface ServerHistoryDto {
  serverName: string;
  range: HistoryRange;
  from: string;
  to: string;
  bucketSeconds: number;
  points: HistoryPointDto[];
}

export function getServerHistory(server: string, range: HistoryRange): Promise<ServerHistoryDto> {
  const params = new URLSearchParams({ server, range });
  return apiFetch<ServerHistoryDto>(`/api/monitor/history?${params}`);
}
