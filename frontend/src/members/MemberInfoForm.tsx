import { useState } from "react";
import { Alert, Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { JOB_RANK_LABELS, JOB_RANKS, updateMember } from "../api/members";
import type { JobRank, MemberDto } from "../api/members";

interface Props {
  member: Pick<MemberDto, "id" | "name" | "department" | "jobRank" | "phone" | "extension">;
  submitLabel: string;
  onSaved: () => void;
  onCancel?: () => void;
}

// 팀원 정보 입력 양식 (팀원 정보 수정 창과 승인 후 내 정보 입력 화면에서 같이 사용)
// 이름·부서·직급은 필수, 전화번호·내선번호는 선택
export function MemberInfoForm({ member, submitLabel, onSaved, onCancel }: Props) {
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
      save.mutate();
    }}>
      <Stack>
        <TextInput label="이름" value={name} maxLength={50} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <TextInput label="부서" value={department} maxLength={100} onChange={(e) => setDepartment(e.currentTarget.value)} />
        {/* 개발자 직급은 고를 수 없고, 개발자 본인도 직급은 바꿀 수 없음 */}
        {member.jobRank === "DEVELOPER" ? (
          <Select label="직급" data={[{ value: "DEVELOPER", label: JOB_RANK_LABELS.DEVELOPER }]} value="DEVELOPER" disabled
            description="개발자 직급은 바꿀 수 없습니다." />
        ) : (
          <Select label="직급" placeholder="직급 선택" data={JOB_RANKS} value={jobRank} onChange={(v) => setJobRank(v as JobRank | null)} />
        )}
        <TextInput label="전화번호" placeholder="010-0000-0000" value={phone} maxLength={20} inputMode="tel"
          onChange={(e) => setPhone(e.currentTarget.value)} />
        <TextInput label="내선번호" placeholder="1234" value={extension} maxLength={10} inputMode="numeric"
          onChange={(e) => setExtension(e.currentTarget.value)} />
        {save.error && <Alert color="red">{save.error instanceof ApiError ? save.error.message : "저장하지 못했습니다."}</Alert>}
        <Group justify="flex-end">
          {onCancel && <Button variant="default" onClick={onCancel}>취소</Button>}
          <Button type="submit" loading={save.isPending} disabled={!name.trim() || !department.trim() || !jobRank}>{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
