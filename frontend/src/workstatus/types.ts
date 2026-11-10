import type { WorkStatusType } from "../api/workStatuses";

// 하루 안에서 표시되는 종류 순서 (서버 정렬과 동일)
export const TYPE_ORDER: WorkStatusType[] = ["LEAVE", "HALF_DAY", "QUARTER_DAY", "TEAM_LEAVE", "BUSINESS_TRIP", "OUTSIDE_WORK", "OTHER"];

export const TYPE_LABELS: Record<WorkStatusType, string> = {
  LEAVE: "연차",
  HALF_DAY: "반차",
  QUARTER_DAY: "반반차",
  TEAM_LEAVE: "팀자율연차",
  BUSINESS_TRIP: "출장",
  OUTSIDE_WORK: "외근",
  OTHER: "기타",
};

// 종류별 칩 색상 (연차 파랑, 반차 초록, 반반차 호박, 팀자율연차 청록, 출장 보라, 외근 빨강, 기타 회색)
export const TYPE_COLORS: Record<WorkStatusType, string> = {
  LEAVE: "blue",
  HALF_DAY: "green",
  QUARTER_DAY: "yellow",
  TEAM_LEAVE: "teal",
  BUSINESS_TRIP: "violet",
  OUTSIDE_WORK: "red",
  OTHER: "gray",
};
