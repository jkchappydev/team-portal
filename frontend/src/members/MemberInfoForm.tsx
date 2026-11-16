import { useState } from "react";
import { Alert, Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { JOB_RANKS, updateMember } from "../api/members";
import { formatExtension, formatPhone } from "./phone";
import type { JobRank, MemberDto } from "../api/members";

interface Props {
  member: Pick<MemberDto, "id" | "name" | "department" | "jobRank" | "phone" | "extension">;
  submitLabel: string;
  onSaved: () => void;
  onCancel?: () => void;
  // 미리보기: 저장하지 않고 onSaved만 부름
  preview?: boolean;
}

// 고를 수 있는 부서 (우선 한 곳)
export const DEPARTMENTS = ["개발팀"];

function departmentOptions(current: string | null | undefined): string[] {
  return current && !DEPARTMENTS.includes(current) ? [...DEPARTMENTS, current] : DEPARTMENTS;
}

// 팀원 정보 입력 양식 (팀원 정보 수정 창과 승인 후 내 정보 입력 화면에서 같이 사용)
// 이름은 구글 계정 이름 그대로 보여 주기만 하고, 부서·직책·전화번호·내선번호는 모두 필수
export function MemberInfoForm({ member, submitLabel, onSaved, onCancel, preview = false }: Props) {
  const [department, setDepartment] = useState(member.department ?? "");
  const [jobRank, setJobRank] = useState<JobRank | null>(member.jobRank ?? null);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [extension, setExtension] = useState(member.extension ?? "");
  const save = useMutation({
    mutationFn: () => updateMember(member.id, {
      department: department.trim(), jobRank: jobRank!, phone: phone.trim(), extension: extension.trim(),
    }),
    onSuccess: onSaved,
  });
  // 모든 칸 필수, 전화번호는 국번 포함 9자리 이상
  const complete = !!department.trim() && !!jobRank
    && phone.replace(/\D/g, "").length >= 9 && !!extension.trim();
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (preview) onSaved();
      else save.mutate();
    }}>
      <Stack>
        {/* 이름은 가입한 구글 계정 이름 그대로 보여 주기만 함 */}
        <TextInput label="이름" value={member.name} readOnly variant="filled" description="구글 계정 이름으로 표시됩니다." />
        {/* 부서는 정해진 목록에서 고름 (예전에 직접 적은 부서는 목록에 함께 보여 값이 사라지지 않게 함) */}
        <Select label="부서" withAsterisk placeholder="부서 선택" data={departmentOptions(member.department)} value={department || null}
          onChange={(v) => setDepartment(v ?? "")} allowDeselect={false} />
        <Select label="직책" withAsterisk placeholder="직책 선택" data={JOB_RANKS} value={jobRank}
          onChange={(v) => setJobRank(v as JobRank | null)} />
        {/* 숫자만 쳐도 하이픈을 넣고, 내선번호는 숫자 3자리까지 */}
        <TextInput label="전화번호" withAsterisk placeholder="010-0000-0000" value={phone} maxLength={13} inputMode="tel"
          onChange={(e) => setPhone(formatPhone(e.currentTarget.value))} />
        <TextInput label="내선번호" withAsterisk placeholder="123" value={extension} maxLength={3} inputMode="numeric"
          onChange={(e) => setExtension(formatExtension(e.currentTarget.value))} />
        {save.error && <Alert color="red">{save.error instanceof ApiError ? save.error.message : "저장하지 못했습니다."}</Alert>}
        <Group justify="flex-end">
          {onCancel && <Button variant="default" onClick={onCancel}>취소</Button>}
          <Button type="submit" loading={save.isPending} disabled={!complete}>{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
