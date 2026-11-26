import type { JobRank, MemberDto } from "../api/members";

// 부서·직책·전화번호·내선번호 입력값
export interface MemberInfoValues {
  department: string;
  jobRank: JobRank | null;
  phone: string;
  extension: string;
}

export function toMemberInfoValues(member: Pick<MemberDto, "department" | "jobRank" | "phone" | "extension">): MemberInfoValues {
  return {
    department: member.department ?? "", jobRank: member.jobRank ?? null,
    phone: member.phone ?? "", extension: member.extension ?? "",
  };
}

// 모든 칸 필수, 전화번호는 국번 포함 9자리 이상
export function isMemberInfoComplete(values: MemberInfoValues): boolean {
  return !!values.department.trim() && !!values.jobRank
    && values.phone.replace(/\D/g, "").length >= 9 && !!values.extension.trim();
}

// 서버로 보낼 값 (앞뒤 공백 제거)
export function memberInfoRequest(values: MemberInfoValues) {
  return {
    department: values.department.trim(), jobRank: values.jobRank!, phone: values.phone.trim(), extension: values.extension.trim(),
  };
}
