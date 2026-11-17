import { useState, type ReactNode } from "react";
import {
  ActionIcon, Alert, Anchor, Avatar, Box, Button, Group, Menu, Modal, Paper, SimpleGrid, Stack, Text, TextInput, Title, UnstyledButton,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONTACTS_KEY, deleteContact, listContacts } from "../api/contacts";
import type { ContactDto } from "../api/contacts";
import { ContactDialog } from "./ContactDialog";
import { contactColor } from "./contactColor";
import { formatDate } from "../documents/format";

// 검색어가 이름·업체·이메일·전화번호 1·2·연관 프로젝트·메모 중 하나에 들어 있으면 표시
function matches(contact: ContactDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return [contact.name, contact.company, contact.email, contact.project, contact.memo]
    .some((value) => value?.toLowerCase().includes(q))
    || (digits.length > 0 && [contact.phone, contact.phone2].some((phone) => (phone ?? "").replace(/\D/g, "").includes(digits)));
}

type SortKey = "name" | "company";
type SortState = { key: SortKey; direction: "asc" | "desc" };

// 같은 버튼을 다시 누르면 오름차순·내림차순을 번갈아, 다른 버튼은 오름차순부터
function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

// 가나다순 정렬, 빈 값은 방향과 관계없이 맨 뒤
function sortContacts(contacts: ContactDto[], sort: SortState): ContactDto[] {
  return [...contacts].sort((a, b) => {
    const x = a[sort.key] ?? "";
    const y = b[sort.key] ?? "";
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    const order = x.localeCompare(y, "ko", { numeric: true });
    return sort.direction === "asc" ? order : -order;
  });
}

// 눌러서 정렬하는 버튼 (정렬 중인 기준에 방향 표시)
function SortButton({ label, direction, onClick }: { label: string; direction: "asc" | "desc" | null; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick} fz="sm" fw={600} aria-label={`${label} 정렬`} className="sort-header"
      data-active={direction ? true : undefined}
      aria-pressed={direction !== null}>
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

// 카드 안 연락 수단 아이콘 (메일·전화)
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

// 카드 안 한 줄 (아이콘 + 내용)
function InfoLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Group gap={8} wrap="nowrap" align="flex-start">
      {/* 아이콘 칸 높이를 글자 한 줄 높이와 같게 두고 가운데 정렬 (이메일이 두 줄이 돼도 첫 줄에 맞춤) */}
      <Box c="dimmed" style={{
        display: "flex", alignItems: "center", flex: "none",
        height: "calc(var(--mantine-font-size-sm) * var(--mantine-line-height-sm))",
      }}>{icon}</Box>
      {/* 글자 칸도 같은 글자 크기·줄 높이로 (기본 16px 줄 높이가 남아 24.8px로 커지면 아이콘이 위로 쏠림) */}
      <Box style={{ minWidth: 0, fontSize: "var(--mantine-font-size-sm)", lineHeight: "var(--mantine-line-height-sm)" }}>{children}</Box>
    </Group>
  );
}

// 연락처 한 장 (명함 모양, 수정·삭제는 ⋯ 메뉴)
function ContactCard({ contact, onEdit, onDelete }: {
  contact: ContactDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const phones = [contact.phone, contact.phone2].filter((phone): phone is string => !!phone);
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      className="contact-card"
      // 최종 수정일을 카드 맨 아래에 붙이도록 세로로 채움 (같은 줄 카드끼리 높이가 같음)
      style={{ display: "flex", flexDirection: "column" }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" mb="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {/* 고른 색 (없으면 연락처마다 정해진 자동 색) */}
          <Avatar radius="xl" variant="filled" color={contactColor(contact)}>{contact.name.slice(0, 1)}</Avatar>
          <div style={{ minWidth: 0 }}>
            <Text fw={600} truncate>{contact.name}</Text>
            <Text size="sm" c="dimmed" truncate>{contact.company || "업체 없음"}</Text>
          </div>
        </Group>
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
      </Group>
      <Stack gap={6}>
        {/* 이메일·전화번호는 눌러서 바로 메일·전화 */}
        {contact.email && (
          <InfoLine icon={<MailIcon />}>
            <Anchor size="sm" href={`mailto:${contact.email}`} draggable={false} style={{ wordBreak: "break-all" }}>{contact.email}</Anchor>
          </InfoLine>
        )}
        {phones.map((phone) => (
          <InfoLine key={phone} icon={<PhoneIcon />}>
            <Anchor size="sm" href={`tel:${phone}`} draggable={false} c="inherit">{phone}</Anchor>
          </InfoLine>
        ))}
        {!contact.email && phones.length === 0 && <Text size="sm" c="dimmed">연락처 정보 없음</Text>}
      </Stack>
      {(contact.project || contact.memo) && (
        <Stack gap={6} mt="sm" pt="sm" className="contact-card-notes">
          {contact.project && (
            <div>
              <Text size="xs" c="dimmed" fw={600}>연관 프로젝트</Text>
              <Text size="sm" style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>{contact.project}</Text>
            </div>
          )}
          {contact.memo && (
            <div>
              <Text size="xs" c="dimmed" fw={600}>메모</Text>
              <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>{contact.memo}</Text>
            </div>
          )}
        </Stack>
      )}
      {/* 오른쪽 아래 최종 수정일 */}
      <Text size="xs" c="dimmed" ta="right" mt="auto" pt="sm">최종 수정 {formatDate(contact.updatedAt)}</Text>
    </Paper>
  );
}

// 외부 연락처: 회사 밖 업체 담당자를 명함 카드로 (팀원 모두가 같이 보고 고침)
export function ContactsPage() {
  const queryClient = useQueryClient();
  const { data: contacts = [], error, isLoading } = useQuery({ queryKey: CONTACTS_KEY, queryFn: listContacts });
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ editing: ContactDto | null } | null>(null);
  const [deleting, setDeleting] = useState<ContactDto | null>(null);
  // 처음에는 이름 가나다순
  const [sort, setSort] = useState<SortState>({ key: "name", direction: "asc" });
  const searching = query.trim().length > 0;
  const visible = sortContacts(contacts.filter((c) => matches(c, query)), sort);
  const sortButton = (key: SortKey, label: string) => (
    <SortButton label={label} direction={sort.key === key ? sort.direction : null} onClick={() => setSort(nextSort(sort, key))} />
  );

  const remove = useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      setDeleting(null);
    },
  });

  return (
    <Stack maw={1300} gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>외부 연락처</Title>
          <Text size="sm" c="dimmed">{contacts.length}명</Text>
        </Group>
        <Button onClick={() => setDialog({ editing: null })}>+ 연락처 추가</Button>
      </Group>
      <Group gap="lg">
        <TextInput placeholder="이름, 업체, 이메일, 전화번호, 프로젝트, 메모 검색" value={query} w={320}
          onChange={(e) => setQuery(e.currentTarget.value)} aria-label="연락처 검색" />
        <Group gap="md">
          {sortButton("name", "이름")}
          {sortButton("company", "업체")}
        </Group>
      </Group>
      {error && <Alert color="red">외부 연락처를 불러오지 못했습니다.</Alert>}
      {!isLoading && visible.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Text size="sm" c="dimmed" ta="center">{searching ? "검색 결과가 없습니다." : "외부 연락처가 없습니다."}</Text>
        </Paper>
      ) : (
        // 화면 폭에 맞춰 1~4장씩, 카드 높이는 같은 줄에서 맞춤
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" verticalSpacing="md">
          {visible.map((contact) => (
            <ContactCard key={contact.id} contact={contact}
              onEdit={() => setDialog({ editing: contact })} onDelete={() => setDeleting(contact)} />
          ))}
        </SimpleGrid>
      )}

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
