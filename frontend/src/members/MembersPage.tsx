import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActionIcon, Alert, Badge, Button, Group, Menu, Modal, Paper, SegmentedControl, Select, Stack, Table, Text, TextInput, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { approveSignup, listSignupRequests, rejectSignup, reopenSignup, setMemberAdmin } from "../api/admin";
import type { SignupRequestDto } from "../api/admin";
import { deleteMember, JOB_RANKS, listMembers, updateMember } from "../api/members";
import type { JobRank, MemberDto } from "../api/members";
import { useCurrentUser } from "../user/currentUser";
import { useMemberReorder } from "./useMemberReorder";

const rankLabel = (rank: JobRank | null | undefined) => JOB_RANKS.find((r) => r.value === rank)?.label ?? "-";

const errorMessage = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

// 처리 전 한 번 더 묻는 확인 창 (페이지 삭제 확인 창과 같은 모양)
function ConfirmModal({ opened, title, message, confirmLabel, pending, onClose, onConfirm }: {
  opened: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack>
        <Text size="sm">{message}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button color="red" loading={pending} onClick={onConfirm}>{confirmLabel}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type ApproveMode = "rejoin" | "new" | "link";

// 가입 요청 한 건: 부서·직급을 정하고 새 팀원으로 만들거나 기존 팀원 기록과 연결해 승인
// 삭제했던 팀원의 재가입이면 기본으로 이전 기록에 다시 연결
function RequestCard({ request, members, refresh }: { request: SignupRequestDto; members: MemberDto[]; refresh: () => void }) {
  const rejoin = request.previousMemberId != null;
  const [mode, setMode] = useState<ApproveMode>(rejoin ? "rejoin" : "new");
  const [name, setName] = useState(request.googleName);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [department, setDepartment] = useState(request.previousDepartment ?? "");
  const [jobRank, setJobRank] = useState<JobRank | null>(request.previousJobRank ?? null);
  const [confirming, setConfirming] = useState(false);
  const action = useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: refresh });
  const pending = request.status === "PENDING";
  // 구글 계정이 아직 없는 활성 팀원만 연결 대상
  const linkable = members.filter((m) => m.active && !m.email).map((m) => ({ value: String(m.id), label: m.name }));
  const ready = !!department.trim() && !!jobRank
    && (mode === "rejoin" || (mode === "new" ? !!name.trim() : !!memberId));
  const modes = [
    ...(rejoin ? [{ value: "rejoin", label: "이전 기록과 다시 연결" }] : []),
    { value: "new", label: "새 팀원으로 등록" },
    { value: "link", label: "기존 팀원과 연결" },
  ];

  const approve = () => {
    if (!jobRank) return;
    const organization = { department: department.trim(), jobRank };
    const target = mode === "new"
      ? { newMemberName: name.trim(), ...organization }
      : { memberId: mode === "rejoin" ? request.previousMemberId! : Number(memberId), ...organization };
    action.mutate(() => approveSignup(request.id, target));
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" wrap="nowrap" mb={pending ? "sm" : 0}>
        <div style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={600}>{request.googleName}</Text>
            {rejoin && <Badge color="teal" variant="light" size="sm">재가입</Badge>}
            {!pending && <Badge color="gray" variant="light" size="sm">거절됨</Badge>}
          </Group>
          <Text size="sm" c="dimmed" truncate>{request.email}</Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Text size="xs" c="dimmed">{new Date(request.requestedAt).toLocaleString("ko-KR")}</Text>
          {!pending && (
            <Button size="xs" variant="default" loading={action.isPending}
              onClick={() => action.mutate(() => reopenSignup(request.id))}>거절 취소</Button>
          )}
        </Group>
      </Group>

      {pending && (
        <Stack gap="sm">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(value) => setMode(value as ApproveMode)}
            data={modes}
            style={{ alignSelf: "flex-start" }}
          />
          <Group grow align="flex-start">
            {mode === "rejoin" ? (
              <TextInput label="다시 연결할 팀원" value={request.previousMemberName ?? ""} readOnly
                description="삭제 전 작성한 문서·근무 상황·연차 기록이 그대로 이어집니다." />
            ) : mode === "new" ? (
              <TextInput label="이름" value={name} maxLength={50} onChange={(e) => setName(e.currentTarget.value)} />
            ) : (
              <Select label="연결할 팀원" placeholder={linkable.length ? "팀원 선택" : "연결할 팀원이 없습니다"}
                data={linkable} value={memberId} onChange={setMemberId} disabled={!linkable.length} />
            )}
            <TextInput label="부서" value={department} maxLength={100} onChange={(e) => setDepartment(e.currentTarget.value)} />
            <Select label="직급" placeholder="직급 선택" data={JOB_RANKS} value={jobRank}
              onChange={(value) => setJobRank(value as JobRank | null)} />
          </Group>
          {action.error && <Alert color="red">{errorMessage(action.error, "처리하지 못했습니다.")}</Alert>}
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="red" onClick={() => setConfirming(true)}>거절</Button>
            <Button disabled={!ready} loading={action.isPending} onClick={approve}>승인</Button>
          </Group>
        </Stack>
      )}
      {!pending && action.error && <Alert color="red" mt="sm">{errorMessage(action.error, "처리하지 못했습니다.")}</Alert>}

      <ConfirmModal
        opened={confirming}
        title="가입 요청 거절"
        message={`${request.googleName}(${request.email})의 가입 요청을 거절할까요? 거절한 요청은 나중에 거절 취소로 되돌릴 수 있습니다.`}
        confirmLabel="거절"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          action.mutate(() => rejectSignup(request.id));
        }}
      />
    </Paper>
  );
}

// 팀원 이름·부서·직급 수정 창
function MemberEditModal({ member, onClose, refresh }: { member: MemberDto; onClose: () => void; refresh: () => void }) {
  const [name, setName] = useState(member.name);
  const [department, setDepartment] = useState(member.department ?? "");
  const [jobRank, setJobRank] = useState<JobRank | null>(member.jobRank ?? null);
  const save = useMutation({
    mutationFn: () => updateMember(member.id, { name: name.trim(), department: department.trim(), jobRank: jobRank! }),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  return (
    <Modal opened onClose={onClose} title="팀원 정보 수정" centered>
      <form onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}>
        <Stack>
          <TextInput label="이름" value={name} maxLength={50} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
          <TextInput label="부서" value={department} maxLength={100} onChange={(e) => setDepartment(e.currentTarget.value)} />
          <Select label="직급" placeholder="직급 선택" data={JOB_RANKS} value={jobRank} onChange={(v) => setJobRank(v as JobRank | null)} />
          {save.error && <Alert color="red">{errorMessage(save.error, "저장하지 못했습니다.")}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>취소</Button>
            <Button type="submit" loading={save.isPending} disabled={!name.trim() || !department.trim() || !jobRank}>저장</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

type MemberAction = "edit" | "delete" | null;

// 팀원 한 줄: 정보는 읽기 전용으로 보여주고 변경은 ⋯ 메뉴에서
function MemberRow({ member, me, refresh, reorder }: {
  member: MemberDto;
  // 로그인한 본인 (자기 자신은 삭제 불가)
  me: boolean;
  refresh: () => void;
  reorder: ReturnType<typeof useMemberReorder>;
}) {
  const [open, setOpen] = useState<MemberAction>(null);
  const action = useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: refresh });
  return (
    <Table.Tr
      data-member-drop={reorder.target?.id === member.id ? (reorder.target.after ? "after" : "before") : undefined}
      onDragOver={(e) => reorder.over(e, member.id)}
      onDrop={(e) => reorder.drop(e, member.id)}
      style={member.active ? undefined : { opacity: 0.55 }}
    >
      <Table.Td style={{ position: "relative" }}>
        <button type="button" className="member-drag-handle" draggable aria-label={`${member.name} 순서 변경`}
          onDragStart={(e) => reorder.start(e, member.id)} onDragEnd={reorder.end}>⠿</button>
        <Group gap={6}>
          <Text size="sm" fw={500}>{member.name}</Text>
          {!member.active && <Badge color="gray" variant="light" size="xs">비활성</Badge>}
        </Group>
        <Text size="xs" c="dimmed">{member.email ?? "구글 계정 연결 안 됨"}</Text>
        {action.error && <Text size="xs" c="red">{errorMessage(action.error, "변경하지 못했습니다.")}</Text>}
      </Table.Td>
      <Table.Td><Text size="sm">{member.department || "-"}</Text></Table.Td>
      <Table.Td><Text size="sm">{rankLabel(member.jobRank)}</Text></Table.Td>
      <Table.Td>
        <Badge variant="light" size="sm" color={member.admin ? "blue" : "gray"}>{member.admin ? "관리자" : "팀원"}</Badge>
      </Table.Td>
      <Table.Td w={40}>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`${member.name} 메뉴`}>⋯</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setOpen("edit")}>정보 수정</Menu.Item>
            <Menu.Item onClick={() => action.mutate(() => setMemberAdmin(member.id, !member.admin))}>
              {member.admin ? "관리자 권한 빼기" : "관리자 권한 주기"}
            </Menu.Item>
            {/* 퇴사자는 삭제로 처리하고, 예전에 비활성으로 바꿔 둔 팀원만 다시 켤 수 있음 */}
            {!member.active && (
              <Menu.Item onClick={() => action.mutate(() => updateMember(member.id, { active: true }))}>다시 활성화</Menu.Item>
            )}
            {!me && (
              <>
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => setOpen("delete")}>팀원 삭제</Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
        {open === "edit" && <MemberEditModal member={member} onClose={() => setOpen(null)} refresh={refresh} />}
        <ConfirmModal
          opened={open === "delete"}
          title="팀원 삭제"
          message={`${member.name} 님을 팀원 목록에서 삭제할까요? 작성한 문서, 근무 상황, 연차 기록은 그대로 남고 이름도 그대로 보입니다. 연차 표에는 삭제한 해까지만 나오고, 삭제한 팀원은 로그인할 수 없습니다. 삭제는 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          pending={action.isPending}
          onClose={() => setOpen(null)}
          onConfirm={() => {
            setOpen(null);
            action.mutate(() => deleteMember(member.id));
          }}
        />
      </Table.Td>
    </Table.Tr>
  );
}

// 관리자 전용 팀원 관리: 가입 요청 승인과 팀원 정보·권한·순서 관리
export function MembersPage() {
  const client = useQueryClient();
  const { user } = useCurrentUser();
  const { data: members = [], error } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true) });
  const { data: requests = [] } = useQuery({ queryKey: ["admin", "signup-requests"], queryFn: listSignupRequests });
  const reorder = useMemberReorder(members.map((m) => m.id), true);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["members"] });
    void client.invalidateQueries({ queryKey: ["admin"] });
    void client.invalidateQueries({ queryKey: ["auth", "me"] });
  };
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <Stack maw={960} gap="xl">
      <div>
        <Title order={3}>팀원 관리</Title>
        <Text size="sm" c="dimmed">가입 요청을 승인하고 팀원 정보와 권한을 관리합니다.</Text>
      </div>

      <Stack gap="sm">
        <Group gap="xs">
          <Title order={5}>가입 요청</Title>
          {pendingCount > 0 && <Badge size="sm" variant="filled">{pendingCount}</Badge>}
        </Group>
        {requests.length === 0 ? (
          <Paper withBorder radius="md" p="md"><Text size="sm" c="dimmed">대기 중인 가입 요청이 없습니다.</Text></Paper>
        ) : (
          requests.map((request) => <RequestCard key={request.id} request={request} members={members} refresh={refresh} />)
        )}
      </Stack>

      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={5}>팀원</Title>
            <Text size="sm" c="dimmed">{members.filter((m) => m.active).length}명</Text>
          </Group>
          <Text size="xs" c="dimmed">왼쪽 손잡이를 끌어 순서를 바꿀 수 있습니다.</Text>
        </Group>
        {error && <Alert color="red">팀원 목록을 불러오지 못했습니다.</Alert>}
        {reorder.error && <Alert color="red">팀원 순서를 저장하지 못했습니다.</Alert>}
        <Paper withBorder radius="md" px="md" py="xs">
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>이름</Table.Th>
                <Table.Th>부서</Table.Th>
                <Table.Th>직급</Table.Th>
                <Table.Th>권한</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.map((member) => (
                <MemberRow key={member.id} member={member} me={member.id === user?.id} refresh={refresh} reorder={reorder} />
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </Stack>
  );
}
