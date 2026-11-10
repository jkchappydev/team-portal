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
// 이름·부서·직급은 필수, 전화번호·내선번호는 선택
export function MemberInfoForm({ member, submitLabel, onSaved, onCancel, preview = false }: Props) {
  const [name, setName] = useState(member.name);
  const [department, setDepartment] = useState(member.department ?? "");
  const [jobRank, setJobRank] = useState<JobRank | null>(member.jobRank ?? null);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [extension, setExtension] = useState(member.extension ?? "");
  const save = useMutation({
    mutationFn: () => updateMember(member.id, {
      name: name.trim(), department: department.trim(), jobRank: jobRank!, phone: phone.trim(), extension: extension.trim(),
    }),
    onSuccess: onSaved,
  });
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (preview) onSaved();
      else save.mutate();
    }}>
      <Stack>
        <TextInput label="이름" value={name} maxLength={50} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        {/* 부서는 정해진 목록에서 고름 (예전에 직접 적은 부서는 목록에 함께 보여 값이 사라지지 않게 함) */}
        <Select label="부서" placeholder="부서 선택" data={departmentOptions(member.department)} value={department || null}
          onChange={(v) => setDepartment(v ?? "")} allowDeselect={false} />
        <Select label="직급" placeholder="직급 선택" data={JOB_RANKS} value={jobRank} onChange={(v) => setJobRank(v as JobRank | null)} />
        {/* 숫자만 쳐도 하이픈을 넣고, 내선번호는 숫자 3자리까지 */}
        <TextInput label="전화번호" placeholder="010-0000-0000" value={phone} maxLength={13} inputMode="tel"
          onChange={(e) => setPhone(formatPhone(e.currentTarget.value))} />
        <TextInput label="내선번호" placeholder="123" value={extension} maxLength={3} inputMode="numeric"
          onChange={(e) => setExtension(formatExtension(e.currentTarget.value))} />
        {save.error && <Alert color="red">{save.error instanceof ApiError ? save.error.message : "저장하지 못했습니다."}</Alert>}
        <Group justify="flex-end">
          {onCancel && <Button variant="default" onClick={onCancel}>취소</Button>}
          <Button type="submit" loading={save.isPending} disabled={!name.trim() || !department.trim() || !jobRank}>{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
