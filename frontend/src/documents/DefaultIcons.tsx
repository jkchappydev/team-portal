import type { ReactNode } from "react";

interface Props {
  // 기본은 주변 글자 크기
  size?: number | string;
}

// 아이콘을 고르지 않은 곳에 쓰는 lucide 선 아이콘 (이모지 대신, 흐린 회색)
function LineIcon({ size = "1em", children }: Props & { children: ReactNode }) {
  return (
    <svg className="default-line-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function PageLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </LineIcon>
  );
}

export function FileLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </LineIcon>
  );
}

export function ScheduleLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16M10 6h8M8 11h7M12 16h6" />
    </LineIcon>
  );
}

export function CalloutLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" />
    </LineIcon>
  );
}

export function ColumnsLineIcon({ count, ...props }: Props & { count: 2 | 3 }) {
  return (
    <LineIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d={count === 2 ? "M12 3v18" : "M9 3v18M15 3v18"} />
    </LineIcon>
  );
}

export function ImageLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </LineIcon>
  );
}

// 이전·다음, 펼침 표시용 꺾쇠 (글자 ◀▶ 대신)
export function ChevronLineIcon({ direction, ...props }: Props & { direction: "left" | "right" }) {
  return (
    <LineIcon {...props}>
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </LineIcon>
  );
}

export function ExternalLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </LineIcon>
  );
}

export function CameraLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </LineIcon>
  );
}

export function UploadLineIcon(props: Props) {
  return (
    <LineIcon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </LineIcon>
  );
}
