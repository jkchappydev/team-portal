import type { NewCsDto } from "../api/cs";

// 처음 받은 목록은 기준으로만 쓰고, 이후 목록에서 처음 보는 요청(REQS) 상태 CS만 알림 대상으로 고름
// seen이 null이면 첫 조회라 알림 없이 기준만 만듦
export function pickNewRequests(seen: ReadonlySet<number> | null, items: NewCsDto[]): {
  seen: Set<number>;
  fresh: NewCsDto[];
} {
  const next = new Set(seen ?? []);
  items.forEach((cs) => next.add(cs.id));
  if (!seen) return { seen: next, fresh: [] };
  return { seen: next, fresh: items.filter((cs) => !seen.has(cs.id) && cs.status === "REQS") };
}
