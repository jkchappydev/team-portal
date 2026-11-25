import type { CSSProperties } from "react";
import { ActionIcon } from "@mantine/core";

interface Props {
  // 화면 낭독기·마우스 올림 안내 문구 (예: 내부 프로젝트 새로 만들기)
  label: string;
  onClick: () => void;
  loading?: boolean;
}

// 사이드바 칸 머리글 오른쪽의 + 버튼 (프로젝트 새로 만들기·링크 추가 공통)
// 시안처럼 머리글 글자와 같은 옅은 회색의 작은 +, 마우스를 올리면 바탕만 옅게
const ICON_COLOR = { "--ai-color": "var(--mantine-color-dimmed)" } as CSSProperties;
export function SidebarAddButton({ label, onClick, loading }: Props) {
  return (
    <ActionIcon variant="subtle" color="gray" size="sm" aria-label={label} title={label} loading={loading} onClick={onClick}
      style={ICON_COLOR}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </ActionIcon>
  );
}
