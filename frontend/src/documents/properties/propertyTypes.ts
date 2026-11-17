import type { PropertyType } from "../../api/properties";

// 속성 종류: 메뉴 이름(새 속성의 기본 이름)과 아이콘
export const PROPERTY_TYPES: { type: PropertyType; label: string; icon: string }[] = [
  { type: "PERSON", label: "사람", icon: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" },
  { type: "TEXT", label: "텍스트", icon: "M3 4h10M3 8h10M3 12h6" },
  { type: "NUMBER", label: "숫자", icon: "M6 2 4.5 14M11.5 2 10 14M2.5 5.5h11M2 10.5h11" },
  { type: "DATE", label: "날짜", icon: "M3 4h10v9H3zM3 7h10M6 2v3M10 2v3" },
  { type: "CHECKBOX", label: "체크박스", icon: "M3 3h10v10H3zM5.5 8l2 2 3.5-4" },
  { type: "URL", label: "URL", icon: "M7 9a3 3 0 0 0 4 .2l2-2a3 3 0 0 0-4.2-4.2l-1 1M9 7a3 3 0 0 0-4-.2l-2 2a3 3 0 0 0 4.2 4.2l1-1" },
];

// 끌어 놓은 줄 위치(앞·뒤)를 옮긴 뒤 목록 위치로 (끌던 줄을 뺀 목록 기준)
export function dropIndex(from: number, target: number, after: boolean): number {
  const to = target + (after ? 1 : 0);
  return from < to ? to - 1 : to;
}
