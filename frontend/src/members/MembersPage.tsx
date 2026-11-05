import { useState } from "react";
import { Alert, Button, Group, Modal, Select, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveSignup, listSignupRequests, rejectSignup, reopenSignup, setMemberAdmin } from "../api/admin";
import type { SignupRequestDto } from "../api/admin";
import { createMember, JOB_RANKS, listMembers, updateMember } from "../api/members";
import type { JobRank, MemberDto } from "../api/members";
import { useCurrentUser } from "../user/currentUser";
import { useMemberReorder } from "./useMemberReorder";

function RequestRow({ request, members, refresh }: { request: SignupRequestDto; members: MemberDto[]; refresh: () => void }) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [name, setName] = useState(request.googleName);
  const [department, setDepartment] = useState("");
  const [jobRank, setJobRank] = useState<JobRank | null>(null);
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => action(), onSuccess: refresh });
  return <Stack gap="xs" p="sm" style={{ border: "1px solid var(--mantine-color-default-border)" }}>
    <Text>{request.googleName} · {request.email} · {new Date(request.requestedAt).toLocaleString("ko-KR")} · {request.status === "PENDING" ? "대기" : "거절"}</Text>
    {request.status === "PENDING" ? <>
      <Group><TextInput label="부서" value={department} maxLength={100} onChange={(event) => setDepartment(event.currentTarget.value)} />
        <Select label="직급" data={JOB_RANKS} value={jobRank} onChange={(value) => setJobRank(value as JobRank | null)} /></Group>
      <Group><Select placeholder="기존 팀원 선택" value={memberId} onChange={setMemberId}
        data={members.filter((member) => member.active && !member.email).map((member) => ({ value: String(member.id), label: member.name }))} />
        <Button disabled={!memberId || !department.trim() || !jobRank} onClick={() => jobRank && mutation.mutate(() => approveSignup(request.id, { memberId: Number(memberId), department: department.trim(), jobRank }))}>기존 팀원과 연결</Button></Group>
      <Group><TextInput value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={50} />
        <Button disabled={!name.trim() || !department.trim() || !jobRank} onClick={() => jobRank && mutation.mutate(() => approveSignup(request.id, { newMemberName: name.trim(), department: department.trim(), jobRank }))}>새 팀원으로 등록</Button>
        <Button color="red" variant="subtle" onClick={() => setConfirming(true)}>거절</Button></Group>
      <Modal opened={confirming} onClose={() => setConfirming(false)} title="가입 요청 거절" centered>
        <Text mb="md">이 가입 요청을 거절하시겠습니까?</Text><Button color="red" onClick={() => { mutation.mutate(() => rejectSignup(request.id)); setConfirming(false); }}>거절</Button>
      </Modal>
    </> : <Button onClick={() => mutation.mutate(() => reopenSignup(request.id))}>거절 취소</Button>}
    {mutation.error && <Text c="red">처리하지 못했습니다. 다시 확인해 주세요.</Text>}
  </Stack>;
}

function MemberRow({ member, admin, refresh, reorder }: { member: MemberDto; admin: boolean; refresh: () => void; reorder: ReturnType<typeof useMemberReorder> }) {
  const [name, setName] = useState(member.name);
  const [department, setDepartment] = useState(member.department ?? "");
  const [jobRank, setJobRank] = useState<JobRank | null>(member.jobRank ?? null);
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => action(), onSuccess: refresh });
  return <Table.Tr data-member-drop={reorder.target?.id === member.id ? (reorder.target.after ? "after" : "before") : undefined}
    onDragOver={(event) => reorder.over(event, member.id)} onDrop={(event) => reorder.drop(event, member.id)}>
    <Table.Td style={{ position: "relative" }}>{admin && <button type="button" className="member-drag-handle" draggable
      aria-label={`${member.name} 순서 변경`} onDragStart={(event) => reorder.start(event, member.id)} onDragEnd={reorder.end}>⠿</button>}
      {admin ? <TextInput value={name} maxLength={50} onChange={(event) => setName(event.currentTarget.value)} /> : member.name}</Table.Td>
    <Table.Td>{admin ? <TextInput aria-label={`${member.name} 부서`} value={department} maxLength={100} onChange={(event) => setDepartment(event.currentTarget.value)} /> : member.department ?? "-"}</Table.Td>
    <Table.Td>{admin ? <Select aria-label={`${member.name} 직급`} data={JOB_RANKS} value={jobRank} onChange={(value) => setJobRank(value as JobRank | null)} /> : JOB_RANKS.find((rank) => rank.value === member.jobRank)?.label ?? "-"}</Table.Td>
    <Table.Td>{member.email ?? "연결 안 됨"}</Table.Td><Table.Td>{member.admin ? "관리자" : "팀원"}</Table.Td>
    <Table.Td>{admin ? <Group>
      <Switch checked={member.active} label={member.active ? "활성" : "비활성"} onChange={(event) => {
        const active = event.currentTarget.checked;
        mutation.mutate(() => updateMember(member.id, { active }));
      }} />
      <Button size="xs" disabled={!name.trim() || !department.trim() || !jobRank || (name.trim() === member.name && department.trim() === member.department && jobRank === member.jobRank)}
        onClick={() => jobRank && mutation.mutate(() => updateMember(member.id, { name: name.trim(), department: department.trim(), jobRank }))}>정보 저장</Button>
      <Button size="xs" variant="subtle" onClick={() => mutation.mutate(() => setMemberAdmin(member.id, !member.admin))}>{member.admin ? "관리자 권한 빼기" : "관리자 권한 주기"}</Button>
    </Group> : member.active ? "활성" : "비활성"}{mutation.error && <Text c="red">변경하지 못했습니다.</Text>}</Table.Td></Table.Tr>;
}

export function MembersPage() {
  const client = useQueryClient();
  const { user } = useCurrentUser();
  const admin = !!user?.admin;
  const [newName, setNewName] = useState("");
  const { data: members = [], error } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true) });
  const reorder = useMemberReorder(members.map((member) => member.id), admin);
  const { data: requests = [] } = useQuery({ queryKey: ["admin", "signup-requests"], queryFn: listSignupRequests, enabled: admin });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["members"] }); void client.invalidateQueries({ queryKey: ["admin"] }); void client.invalidateQueries({ queryKey: ["auth", "me"] }); };
  const create = useMutation({ mutationFn: createMember, onSuccess: () => { refresh(); setNewName(""); } });
  return <Stack maw={1000}><Title order={3}>팀원 관리</Title>
    {admin && <><Title order={4}>가입 요청</Title>{requests.length === 0 && <Text>가입 요청이 없습니다.</Text>}
      {requests.map((request) => <RequestRow key={request.id} request={request} members={members} refresh={refresh} />)}</>}
    {error && <Alert color="red">팀원 목록을 불러오지 못했습니다.</Alert>}
    {reorder.error && <Alert color="red">팀원 순서를 저장하지 못했습니다.</Alert>}
    <div style={{ paddingLeft: admin ? 16 : 0 }}><Table><Table.Thead><Table.Tr><Table.Th>이름</Table.Th><Table.Th>부서</Table.Th><Table.Th>직급</Table.Th><Table.Th>이메일</Table.Th><Table.Th>권한</Table.Th><Table.Th>상태</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{members.map((member) => <MemberRow key={`${member.id}-${member.name}`} member={member} admin={admin} refresh={refresh} reorder={reorder} />)}</Table.Tbody></Table></div>
    {admin && <form onSubmit={(event) => { event.preventDefault(); if (newName.trim()) create.mutate(newName.trim()); }}><Group align="flex-end">
      <TextInput label="새 팀원" value={newName} maxLength={50} onChange={(event) => setNewName(event.currentTarget.value)} error={create.error ? "추가하지 못했습니다." : undefined} />
      <Button type="submit" loading={create.isPending}>추가</Button></Group></form>}
  </Stack>;
}
