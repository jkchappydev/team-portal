import { useRef, useState, type DragEvent } from "react";
import {
  ActionIcon, Alert, Anchor, Badge, Button, Group, Menu, Modal, Paper, Stack, Table, Text, TextInput, Title, UnstyledButton,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONTACTS_KEY, deleteContact, listContacts, moveContact } from "../api/contacts";
import type { ContactDto } from "../api/contacts";
import { useReorderAnimation } from "../layout/reorderAnimation";
import { ContactDialog } from "./ContactDialog";

// 검색어가 이름·업체·이메일·전화번호·연관 프로젝트 중 하나에 들어 있으면 표시
function matches(contact: ContactDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return [contact.name, contact.company, contact.email, ...contact.projects]
    .some((value) => value?.toLowerCase().includes(q))
    || (digits.length > 0 && (contact.phone ?? "").replace(/\D/g, "").includes(digits));
}

type SortKey = "name" | "company" | "projects";
type SortState = { key: SortKey; direction: "asc" | "desc" } | null;

// 머리글을 누를 때마다 오름차순 → 내림차순 → 정렬 해제(저장한 순서)
function nextSort(current: SortState, key: SortKey): SortState {
  if (current?.key !== key) return { key, direction: "asc" };
  return current.direction === "asc" ? { key, direction: "desc" } : null;
}

// 가나다순 정렬, 연관 프로젝트는 첫 프로젝트 이름 기준, 빈 값은 방향과 관계없이 맨 아래
function sortContacts(contacts: ContactDto[], sort: SortState): ContactDto[] {
  if (!sort) return contacts;
  const valueOf = (c: ContactDto) => (sort.key === "projects" ? c.projects[0] : c[sort.key]) ?? "";
  return [...contacts].sort((a, b) => {
    const x = valueOf(a);
    const y = valueOf(b);
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    const order = x.localeCompare(y, "ko", { numeric: true });
    return sort.direction === "asc" ? order : -order;
  });
}

// 눌러서 정렬하는 표 머리글 (정렬 중인 열에 화살표 표시)
function SortHeader({ label, direction, onClick }: { label: string; direction: "asc" | "desc" | null; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick} fw={700} fz="sm" aria-label={`${label} 정렬`} className="sort-header"
      data-active={direction ? true : undefined}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
      {label}
      <SortIcon direction={direction} />
    </UnstyledButton>
  );
}

// 위·아래 꺾쇠 한 쌍: 정렬 방향 쪽만 진하게, 정렬 전에는 둘 다 흐리게
function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  return (
    <svg className="sort-icon" width="10" height="14" viewBox="0 0 10 14" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5 5 2.5l3 3" data-on={direction === "asc" ? true : undefined} />
      <path d="M2 8.5l3 3 3-3" data-on={direction === "desc" ? true : undefined} />
    </svg>
  );
}

// 끌어서 순서 바꾸기 (팀원 목록과 같은 줄 사이 가로선 표시, 검색 중에는 끔)
function useContactReorder(ids: number[], enabled: boolean) {
  const [target, setTarget] = useState<{ id: number; after: boolean } | null>(null);
  const dragging = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveContact(id, index),
    // 화면 순서를 먼저 바꾸고 서버 반영 후 다시 조회 (실패 시 서버 순서로 복구)
    onMutate: ({ id, index }) => {
      const current = queryClient.getQueryData<ContactDto[]>(CONTACTS_KEY) ?? [];
      const moving = current.find((c) => c.id === id);
      if (!moving) return;
      const others = current.filter((c) => c.id !== id);
      others.splice(index, 0, moving);
      queryClient.setQueryData(CONTACTS_KEY, others);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
  const afterHalf = (event: DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY >= rect.top + rect.height / 2;
  };
  const start = (event: DragEvent<HTMLElement>, id: number) => {
    if (!enabled) { event.preventDefault(); return; }
    dragging.current = id;
    event.dataTransfer.clearData();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  };
  const over = (event: DragEvent<HTMLElement>, id: number) => {
    if (!enabled || dragging.current === null) return;
    event.preventDefault();
    setTarget({ id, after: afterHalf(event) });
  };
  const drop = (event: DragEvent<HTMLElement>, id: number) => {
    if (!enabled || dragging.current === null) return;
    event.preventDefault();
    const moving = dragging.current;
    const remaining = ids.filter((value) => value !== moving);
    const at = remaining.indexOf(id);
    if (at >= 0) {
      const index = at + (afterHalf(event) ? 1 : 0);
      if (index !== ids.indexOf(moving)) move.mutate({ id: moving, index });
    }
    dragging.current = null;
    setTarget(null);
  };
  const end = () => { dragging.current = null; setTarget(null); };
  return { start, over, drop, end, target, error: move.error };
}

// 연락처 한 줄 (수정·삭제는 ⋯ 메뉴)
function ContactRow({ contact, reorder, canDrag, onEdit, onDelete }: {
  contact: ContactDto;
  reorder: ReturnType<typeof useContactReorder>;
  canDrag: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Table.Tr
      data-flip-id={`contact-${contact.id}`}
      data-member-drop={reorder.target?.id === contact.id ? (reorder.target.after ? "after" : "before") : undefined}
      onDragOver={(e) => reorder.over(e, contact.id)}
      onDrop={(e) => reorder.drop(e, contact.id)}
    >
      <Table.Td style={{ position: "relative" }}>
        {canDrag && (
          <button type="button" className="member-drag-handle" draggable aria-label={`${contact.name} 순서 변경`}
            onDragStart={(e) => reorder.start(e, contact.id)} onDragEnd={reorder.end}>⠿</button>
        )}
        <Text size="sm" fw={500}>{contact.name}</Text>
      </Table.Td>
      <Table.Td><Text size="sm">{contact.company || "-"}</Text></Table.Td>
      <Table.Td>
        {contact.email
          ? <Anchor size="sm" href={`mailto:${contact.email}`} draggable={false} style={{ wordBreak: "break-all" }}>{contact.email}</Anchor>
          : <Text size="sm">-</Text>}
      </Table.Td>
      <Table.Td>
        {contact.phone
          ? <Anchor size="sm" href={`tel:${contact.phone}`} draggable={false} c="inherit">{contact.phone}</Anchor>
          : <Text size="sm">-</Text>}
      </Table.Td>
      <Table.Td>
        {contact.projects.length > 0 ? (
          <Group gap={4}>
            {contact.projects.map((project) => <Badge key={project} variant="light" size="sm" style={{ textTransform: "none" }}>{project}</Badge>)}
          </Group>
        ) : <Text size="sm">-</Text>}
      </Table.Td>
      <Table.Td ta="right">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`${contact.name} 메뉴`}>⋯</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onEdit}>연락처 수정</Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" onClick={onDelete}>연락처 삭제</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

// 외부 연락처: 회사 밖 업체 담당자의 업체·이메일·전화번호·연관 프로젝트 (팀원 모두가 같이 보고 고침)
export function ContactsPage() {
  const queryClient = useQueryClient();
  const { data: contacts = [], error, isLoading } = useQuery({ queryKey: CONTACTS_KEY, queryFn: listContacts });
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ editing: ContactDto | null } | null>(null);
  const [deleting, setDeleting] = useState<ContactDto | null>(null);
  // 처음에는 이름 가나다순 (머리글을 계속 누르면 끌어서 정한 저장 순서로도 볼 수 있음)
  const [sort, setSort] = useState<SortState>({ key: "name", direction: "asc" });
  const searching = query.trim().length > 0;
  const visible = sortContacts(contacts.filter((c) => matches(c, query)), sort);
  // 검색·정렬 중에는 보이는 순서가 저장 순서와 달라 끌어서 바꾸기를 끔
  const canDrag = !searching && sort === null;
  const reorder = useContactReorder(contacts.map((c) => c.id), canDrag);
  const header = (key: SortKey, label: string) => (
    <SortHeader label={label} direction={sort?.key === key ? sort.direction : null} onClick={() => setSort(nextSort(sort, key))} />
  );
  // 순서를 바꾸면 줄들이 새 위치로 미끄러지게
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useReorderAnimation(bodyRef);

  const remove = useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      setDeleting(null);
    },
  });

  return (
    <Stack maw={1100} gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>외부 연락처</Title>
          <Text size="sm" c="dimmed">{contacts.length}명</Text>
        </Group>
        <Button onClick={() => setDialog({ editing: null })}>+ 연락처 추가</Button>
      </Group>
      <Group justify="space-between">
        <TextInput placeholder="이름, 업체, 이메일, 전화번호, 프로젝트 검색" value={query} w={320}
          onChange={(e) => setQuery(e.currentTarget.value)} aria-label="연락처 검색" />
        {canDrag && contacts.length > 1 && <Text size="xs" c="dimmed">드래그로 순서를 변경할 수 있습니다.</Text>}
      </Group>
      {error && <Alert color="red">외부 연락처를 불러오지 못했습니다.</Alert>}
      {reorder.error && <Alert color="red">연락처 순서를 저장하지 못했습니다.</Alert>}
      <Paper withBorder radius="md" px="md" py="xs">
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={140}>{header("name", "이름")}</Table.Th>
              <Table.Th w={170}>{header("company", "업체")}</Table.Th>
              <Table.Th w={230}>이메일</Table.Th>
              <Table.Th w={140}>전화번호</Table.Th>
              <Table.Th>{header("projects", "연관 프로젝트")}</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody ref={bodyRef}>
            {visible.map((contact) => (
              <ContactRow key={contact.id} contact={contact} reorder={reorder} canDrag={canDrag}
                onEdit={() => setDialog({ editing: contact })} onDelete={() => setDeleting(contact)} />
            ))}
            {!isLoading && visible.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    {searching ? "검색 결과가 없습니다." : "외부 연락처가 없습니다."}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <ContactDialog opened={dialog !== null} editing={dialog?.editing ?? null} onClose={() => setDialog(null)} />

      {/* 삭제 확인 (링크 삭제 확인 창과 같은 모양) */}
      <Modal opened={deleting !== null} onClose={() => { setDeleting(null); remove.reset(); }} title="연락처 삭제" centered>
        <Stack>
          <Text size="sm">"{deleting?.name}" 연락처를 삭제할까요? 팀원 모두의 목록에서 사라지며 되돌릴 수 없습니다.</Text>
          {remove.error && <Alert color="red">연락처를 삭제하지 못했습니다.</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setDeleting(null); remove.reset(); }}>취소</Button>
            <Button color="red" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)} data-autofocus>삭제</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
