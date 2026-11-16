import { Badge } from "@mantine/core";
import type { CSSProperties } from "react";
import { JOB_RANKS } from "../api/members";
import type { JobRank } from "../api/members";

// 직책 표시 색: 권한 배지(연두·파랑·회색)와 겹치지 않게 직책마다 구분
const RANK_COLORS: Record<JobRank, string> = {
  HEAD: "grape", TEAM_LEAD: "violet", RESPONSIBLE: "cyan", SENIOR: "orange",
};

// 직책 배지 (팀원 목록·관리 표와 사이드바 이름 옆에서 같은 모양으로 사용)
// style: 놓인 곳에 맞춘 모양 (예: 누를 수 있는 버튼 안이면 손가락 커서)
export function RankBadge({ rank, style }: { rank: JobRank; style?: CSSProperties }) {
  return (
    <Badge variant="light" size="sm" color={RANK_COLORS[rank]} style={style}>
      {JOB_RANKS.find((r) => r.value === rank)?.label}
    </Badge>
  );
}
