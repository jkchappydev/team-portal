import type { WorkStatusType } from "../api/workStatuses";

// 하루 안에서 표시되는 종류 순서 (서버 정렬과 동일)
export const TYPE_ORDER: WorkStatusType[] = ["LEAVE", "HALF_DAY", "QUARTER_DAY", "OFFICIAL_LEAVE", "BUSINESS_TRIP", "OUTSIDE_WORK", "OTHER"];

export const TYPE_LABELS: Record<WorkStatusType, string> = {
  LEAVE: "연차",
  HALF_DAY: "반차",
  QUARTER_DAY: "반반차",
  OFFICIAL_LEAVE: "공가",
  BUSINESS_TRIP: "출장",
  OUTSIDE_WORK: "외근",
  OTHER: "기타",
};

// 종류별 칩 색상 (연차 파랑, 반차 초록, 반반차 호박, 공가 청록, 출장 보라, 외근 빨강, 기타 회색)
export const TYPE_COLORS: Record<WorkStatusType, string> = {
  LEAVE: "blue",
  HALF_DAY: "green",
  QUARTER_DAY: "yellow",
  OFFICIAL_LEAVE: "teal",
  BUSINESS_TRIP: "violet",
  OUTSIDE_WORK: "red",
  OTHER: "gray",
};

// 근무 상황 칩: 옅은 배경 + 진한 글자 (다크 모드는 밝은 글자), 근무 상황표와 메인 화면이 같이 씀
// 인라인 스타일이라 운영 빌드 CSS 압축기를 거치지 않아 light-dark()를 그대로 쓸 수 있음
export function chipColors(color: string) {
  return {
    background: `light-dark(var(--mantine-color-${color}-0), color-mix(in srgb, var(--mantine-color-${color}-9) 30%, transparent))`,
    color: `light-dark(var(--mantine-color-${color}-9), var(--mantine-color-${color}-1))`,
  };
}
