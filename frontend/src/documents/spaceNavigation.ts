import type { SpaceDto } from "../api/spaces";

// 보고 있던 최상위 페이지를 지운 뒤 갈 곳: 사이드바 바로 아래 페이지, 맨 아래였으면 바로 위, 남은 페이지가 없으면 근무 상황표
export function pathAfterSpaceDeleted(spaces: SpaceDto[] | undefined, deletedId: number): string {
  const list = spaces ?? [];
  const index = list.findIndex((s) => s.id === deletedId);
  const rest = list.filter((s) => s.id !== deletedId);
  if (rest.length === 0) return "/work-status";
  const next = index < 0 ? rest[0] : rest[Math.min(index, rest.length - 1)];
  return `/spaces/${next.id}`;
}
