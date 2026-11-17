export interface MentionCandidate {
  id: number;
  name: string;
}

// @ 뒤 글자로 활성 팀원을 거름 (이름 일부, 대소문자 무시), 순서는 그대로
export function filterMentionCandidates<T extends MentionCandidate>(members: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q === "" ? members : members.filter((member) => member.name.toLowerCase().includes(q));
}
