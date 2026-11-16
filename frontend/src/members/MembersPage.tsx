import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActionIcon, Alert, Badge, Button, Group, Menu, Modal, Paper, SegmentedControl, Select, Stack, Table, Text, TextInput, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { approveSignup, listSignupRequests, rejectSignup, reopenSignup, setMemberAdmin, setMemberDeveloper } from "../api/admin";
import type { SignupRequestDto } from "../api/admin";
import { Navigate } from "react-router-dom";
import { useReorderAnimation } from "../layout/reorderAnimation";
import { deleteMember, listMembers, updateMember } from "../api/members";
import type { MemberDto } from "../api/members";
import { useCurrentUser } from "../user/currentUser";
import { useMemberReorder } from "./useMemberReorder";
import { MemberInfoForm } from "./MemberInfoForm";
import { RankBadge } from "./RankBadge";


// 권한 표시: 개발자(연두) > 관리자(파랑) > 팀원(회색)
function roleBadge(member: MemberDto) {
  if (member.developer) return { label: "개발자", color: "lime" };
  return member.admin ? { label: "관리자", color: "blue" } : { label: "팀원", color: "gray" };
}

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

// 가입 요청 한 건: 새 팀원으로 만들거나 기존 팀원 기록과 연결해 승인
// 부서·직책 등은 승인된 본인이 처음 들어올 때 직접 입력
// 삭제했던 팀원의 재가입이면 기본으로 이전 기록에 다시 연결
function RequestCard({ request, members, refresh }: { request: SignupRequestDto; members: MemberDto[]; refresh: () => void }) {
  const rejoin = request.previousMemberId != null;
  const [mode, setMode] = useState<ApproveMode>(rejoin ? "rejoin" : "new");
  const [name, setName] = useState(request.googleName);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const action = useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: refresh });
  const pending = request.status === "PENDING";
  // 구글 계정이 아직 없는 활성 팀원만 연결 대상
  const linkable = members.filter((m) => m.active && !m.email).map((m) => ({ value: String(m.id), label: m.name }));
  const ready = mode === "rejoin" || (mode === "new" ? !!name.trim() : !!memberId);
  const modes = [
    ...(rejoin ? [{ value: "rejoin", label: "이전 기록과 다시 연결" }] : []),
    { value: "new", label: "새 팀원으로 등록" },
    { value: "link", label: "기존 팀원과 연결" },
  ];

  const approve = () => {
    const target = mode === "new"
      ? { newMemberName: name.trim() }
      : { memberId: mode === "rejoin" ? request.previousMemberId! : Number(memberId) };
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
          </Group>
          {mode !== "rejoin" && (
            <Text size="xs" c="dimmed">부서·직책·연락처는 승인된 팀원이 처음 들어올 때 직접 입력합니다.</Text>
          )}
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

// 팀원 정보 수정 창
function MemberEditModal({ member, onClose, refresh }: { member: MemberDto; onClose: () => void; refresh: () => void }) {
  return (
    <Modal opened onClose={onClose} title="팀원 정보 수정" centered>
      <MemberInfoForm member={member} submitLabel="저장" onCancel={onClose} onSaved={() => {
        refresh();
        onClose();
      }} />
    </Modal>
  );
}

type MemberAction = "edit" | "delete" | null;

// 팀원 한 줄: 정보는 읽기 전용으로 보여주고 변경은 ⋯ 메뉴에서
// 관리자는 모든 줄을 바꾸고, 일반 팀원은 본인 줄의 정보 수정만 가능
function MemberRow({ member, me, admin, developer, showRole, refresh, reorder }: {
  member: MemberDto;
  // 권한 칸 표시 여부 (팀원 관리 화면에서만)
  showRole: boolean;
  // 로그인한 본인 (자기 자신은 삭제 불가)
  me: boolean;
  // 로그인한 사람이 관리자인지
  admin: boolean;
  // 로그인한 사람이 개발자인지 (개발자 권한 변경 가능)
  developer: boolean;
  refresh: () => void;
  reorder: ReturnType<typeof useMemberReorder>;
}) {
  const [open, setOpen] = useState<MemberAction>(null);
  const action = useMutation({ mutationFn: (run: () => Promise<unknown>) => run(), onSuccess: refresh });
  return (
    <Table.Tr
      data-flip-id={`member-${member.id}`}
      data-member-drop={reorder.target?.id === member.id ? (reorder.target.after ? "after" : "before") : undefined}
      onDragOver={(e) => reorder.over(e, member.id)}
      onDrop={(e) => reorder.drop(e, member.id)}
      style={member.active ? undefined : { opacity: 0.55 }}
    >
      <Table.Td style={{ position: "relative" }}>
        {admin && (
          <button type="button" className="member-drag-handle" draggable aria-label={`${member.name} 순서 변경`}
            onDragStart={(e) => reorder.start(e, member.id)} onDragEnd={reorder.end}>⠿</button>
        )}
        <Group gap={6}>
          <Text size="sm" fw={500}>{member.name}</Text>
          {!member.active && <Badge color="gray" variant="light" size="xs">비활성</Badge>}
        </Group>
        <Text size="xs" c="dimmed">{member.email ?? "구글 계정 연결 안 됨"}</Text>
        {action.error && <Text size="xs" c="red">{errorMessage(action.error, "변경하지 못했습니다.")}</Text>}
      </Table.Td>
      <Table.Td><Text size="sm">{member.department || "-"}</Text></Table.Td>
      <Table.Td>
        {member.jobRank
          ? <RankBadge rank={member.jobRank} />
          : <Text size="sm">-</Text>}
      </Table.Td>
      <Table.Td><Text size="sm">{member.extension || "-"}</Text></Table.Td>
      <Table.Td><Text size="sm">{member.phone || "-"}</Text></Table.Td>
      {showRole && (
        <Table.Td>
          <Badge variant="light" size="sm" color={roleBadge(member).color}>{roleBadge(member).label}</Badge>
        </Table.Td>
      )}
      <Table.Td ta="right">
        {(admin || me) && <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`${member.name} 메뉴`}>⋯</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setOpen("edit")}>정보 수정</Menu.Item>
            {/* 관리자 권한은 관리자·개발자가 바꾸되, 개발자 줄은 개발자 권한을 먼저 빼야 함 */}
            {admin && !member.developer && (
              <Menu.Item onClick={() => action.mutate(() => setMemberAdmin(member.id, !member.admin))}>
                {member.admin ? "관리자 권한 제거" : "관리자 권한 주기"}
              </Menu.Item>
            )}
            {/* 개발자 권한(루트 성격)은 개발자만 주거나 뺌 */}
            {admin && developer && member.active && (
              <Menu.Item onClick={() => action.mutate(() => setMemberDeveloper(member.id, !member.developer))}>
                {member.developer ? "개발자 권한 제거" : "개발자 권한 주기"}
              </Menu.Item>
            )}
            {/* 퇴사자는 삭제로 처리하고, 예전에 비활성으로 바꿔 둔 팀원만 다시 켤 수 있음 */}
            {admin && !member.active && (
              <Menu.Item onClick={() => action.mutate(() => updateMember(member.id, { active: true }))}>다시 활성화</Menu.Item>
            )}
            {admin && !me && !member.developer && (
              <>
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => setOpen("delete")}>팀원 삭제</Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>}
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

// manage: 관리자 전용 팀원 관리 (가입 승인, 팀원 정보·권한·순서 변경)
// list: 누구나 보는 팀원 목록 (순서 변경 없이 본인 정보만 수정)
export function MembersPage({ mode = "manage" }: { mode?: "manage" | "list" }) {
  const client = useQueryClient();
  const { user, me } = useCurrentUser();
  const admin = mode === "manage" && !!user?.admin;
  const { data: members = [], error } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true) });
  const { data: requests = [] } = useQuery({ queryKey: ["admin", "signup-requests"], queryFn: listSignupRequests, enabled: admin });
  const reorder = useMemberReorder(members.map((m) => m.id), admin);
  // 순서를 바꾸면 팀원 줄들이 새 위치로 미끄러지게
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useReorderAnimation(bodyRef);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["members"] });
    void client.invalidateQueries({ queryKey: ["admin"] });
    void client.invalidateQueries({ queryKey: ["auth", "me"] });
  };
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  // 관리자가 아니면 팀원 관리 대신 팀원 목록으로 보냄 (로그인 정보를 받은 뒤 판단)
  if (mode === "manage" && me && !user?.admin) return <Navigate to="/team" replace />;

  return (
    // 가입 요청 상자도 같은 폭 (표 열 폭 합 + 상자 안쪽 여백)
    <Stack maw={mode === "manage" ? 860 : 770} gap="xl">
      <Title order={3}>{mode === "manage" ? "팀원 관리" : "팀원 목록"}</Title>

      {admin && <Stack gap="sm">
        <Group gap="xs">
          <Title order={5}>가입 요청</Title>
          {pendingCount > 0 && <Badge size="sm" variant="filled">{pendingCount}</Badge>}
        </Group>
        {requests.length === 0 ? (
          <Paper withBorder radius="md" p="md"><Text size="sm" c="dimmed">대기 중인 가입 요청이 없습니다.</Text></Paper>
        ) : (
          requests.map((request) => <RequestCard key={request.id} request={request} members={members} refresh={refresh} />)
        )}
      </Stack>}

      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={5}>팀원</Title>
            <Text size="sm" c="dimmed">{members.filter((m) => m.active).length}명</Text>
          </Group>
          {admin && <Text size="xs" c="dimmed">드래그로 순서를 변경할 수 있습니다.</Text>}
        </Group>
        {error && <Alert color="red">팀원 목록을 불러오지 못했습니다.</Alert>}
        {reorder.error && <Alert color="red">팀원 순서를 저장하지 못했습니다.</Alert>}
        <Paper withBorder radius="md" px="md" py="xs">
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                {/* 모든 열은 내용 길이에 맞춘 고정 폭, 화면 폭(maw)도 열 합에 맞춰 열 사이가 벌어지지 않게 함 */}
                <Table.Th w={200}>이름</Table.Th>
                <Table.Th w={170}>부서</Table.Th>
                <Table.Th w={80}>직책</Table.Th>
                <Table.Th w={90}>내선번호</Table.Th>
                <Table.Th w={140}>전화번호</Table.Th>
                {/* 권한은 팀원 관리 화면에서만 표시 */}
                {mode === "manage" && <Table.Th w={90}>권한</Table.Th>}
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody ref={bodyRef}>
              {members.map((member) => (
                <MemberRow key={member.id} member={member} me={member.id === user?.id} admin={admin} developer={admin && !!user?.developer} showRole={mode === "manage"}
                  refresh={refresh} reorder={reorder} />
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>

      {/* 팀원 목록에서만: 사무실 전화기 사용법 */}
      {mode === "list" && (
        <Stack gap="sm">
          <Title order={5}>전화기 사용법</Title>
          <Paper withBorder radius="md" px="md" py="xs">
            <Table verticalSpacing="sm">
              <Table.Tbody>
                {PHONE_GUIDE.map(([action, keys]) => (
                  <Table.Tr key={action}>
                    <Table.Td w={200}>{action}</Table.Td>
                    <Table.Td>{keys}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}

// 사무실 전화기 기능별 누르는 순서
const PHONE_GUIDE: [string, string][] = [
  ["당겨받기", "**"],
  ["외부전화", "5 + 전화번호"],
  ["넘기기", "플래시 + 내선번호(3자리)"],
];
