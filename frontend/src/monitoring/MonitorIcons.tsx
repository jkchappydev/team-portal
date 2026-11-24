import type { ReactNode, SVGProps } from "react";

// 모니터링 화면용 선 아이콘 (24 기준 좌표, 글자 색을 따라감, 꾸밈용이라 화면 읽기 프로그램에는 숨김)
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

// CPU: 가운데 칩과 사방의 다리
export function CpuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </Icon>
  );
}

// 메모리: 맥박 선
export function MemoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </Icon>
  );
}

// 디스크: 하드 디스크와 표시등
export function DiskIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 14l2.5-8h11L20 14" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 17h.01M11 17h.01" />
    </Icon>
  );
}

// 가동 시간: 시계
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

// 네트워크: 와이파이 물결
export function NetworkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M12 19h.01" />
    </Icon>
  );
}

// 받기·보내기 화살표
export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v14M6 12l6 6 6-6" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20V6M6 12l6-6 6 6" />
    </Icon>
  );
}

// 상태 표시: 동그라미 안 체크(정상)와 엑스(연결 안 됨)
export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </Icon>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </Icon>
  );
}

// 서버를 읽을 수 있으면 초록 Online, 못 읽으면 빨강 Offline 알약 모양 표시
export function ServerStatusBadge({ online }: { online: boolean }) {
  return (
    <span className={`server-status-badge ${online ? "is-online" : "is-offline"}`}>
      {online ? <CheckCircleIcon size={14} /> : <XCircleIcon size={14} />}
      {online ? "Online" : "Offline"}
    </span>
  );
}
