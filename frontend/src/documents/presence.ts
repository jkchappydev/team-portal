import type { CursorUser } from "./cursorActivity";

// 접속 상태(awareness)에 싣는 사용자 정보: 커서 정보 + 본인이 고른 프로필 색·이미지
export interface PresenceUser extends CursorUser {
  profileColor?: string | null;
  imageUrl?: string | null;
}

// 지금 이 페이지를 보고 있는 사람
export interface Viewer {
  memberId: number;
  name: string;
  color: string;
  imageUrl: string | null;
}

// 접속 상태 목록에서 보는 사람 목록 (나는 맨 앞, 나머지는 이름순, 같은 사람이 여러 창으로 열어도 한 번만)
// 동그라미 색은 본인이 고른 색, 없으면 커서 색
export function viewersOf(states: Map<number, Record<string, unknown>>, selfMemberId: number): Viewer[] {
  const byMember = new Map<number, Viewer>();
  for (const state of states.values()) {
    const user = state.user as PresenceUser | undefined;
    if (user?.memberId == null || byMember.has(user.memberId)) continue;
    byMember.set(user.memberId, {
      memberId: user.memberId,
      name: user.name,
      color: user.profileColor ?? user.color,
      imageUrl: user.imageUrl ?? null,
    });
  }
  const self = byMember.get(selfMemberId);
  byMember.delete(selfMemberId);
  const others = [...byMember.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return self ? [self, ...others] : others;
}

// 동그라미 안에 넣을 짧은 이름 (세 글자 이상이면 성을 뺀 뒤 두 글자)
export function shortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length >= 3 ? trimmed.slice(-2) : trimmed;
}

// 목록이 바뀐 경우에만 화면을 다시 그리도록 비교
export function sameViewers(a: Viewer[], b: Viewer[]): boolean {
  return a.length === b.length && a.every((viewer, i) => viewer.memberId === b[i].memberId
    && viewer.name === b[i].name && viewer.color === b[i].color && viewer.imageUrl === b[i].imageUrl);
}
