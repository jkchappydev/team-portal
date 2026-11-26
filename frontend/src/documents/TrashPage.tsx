import {
  ActionIcon, Alert, Box, Button, Checkbox, Group, Modal, Paper, SegmentedControl, Stack, Table, Text, TextInput, Title,
  Tooltip,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { ApiError } from "../api/client";
import { getTrash, purgeTrashItem, restoreDocument } from "../api/documents";
import type { TrashItemDto } from "../api/documents";
import { restoreSpace } from "../api/spaces";
import { FORMS_KEY, restoreForm } from "../api/forms";
import { FileKindIcon } from "../forms/FileKindIcon";
import { TrashIcon } from "../layout/SidebarIcons";
import { ChevronLineIcon, SearchLineIcon } from "./DefaultIcons";
import { formatDateTime } from "./format";
import { PageIcon } from "./PageIconView";
import { useLastValue } from "../layout/useLastValue";

// 하위 페이지 한 단계당 들여쓰기 폭
const INDENT = 20;

// 표 최소 폭 (좁은 화면에서는 가로 스크롤)
const TABLE_MIN_WIDTH = 860;

// 복원 대상 (하위 페이지는 페이지 복원 API로 위치만 옮김, form은 공유 보관함 파일)
interface RestoreTarget {
  kind: TrashItemDto["kind"];
  id: number;
}

// 종류 필터: 프로젝트, 페이지(최상위·하위 모두), 공유 보관함 파일
type TrashFilter = "all" | "project" | "page" | "file";

const FILTER_LABELS: Record<TrashFilter, string> = { all: "전체", project: "프로젝트", page: "페이지", file: "파일" };

function groupOf(item: TrashItemDto): Exclude<TrashFilter, "all"> {
  if (item.kind === "form") return "file";
  if (item.kind === "space" && item.spaceKind === "PROJECT") return "project";
  return "page";
}

function keyOf(item: TrashItemDto): string {
  return `${item.kind}-${item.id}`;
}

// 이름이나 함께 숨겨진 하위 페이지 제목에 검색어가 들어 있는지
function matchesQuery(item: TrashItemDto, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return item.name.toLowerCase().includes(q) || item.children.some((child) => child.title.toLowerCase().includes(q));
}

// 종류별 복원 API
function restoreItem(target: RestoreTarget): Promise<void> {
  if (target.kind === "space") return restoreSpace(target.id);
  if (target.kind === "form") return restoreForm(target.id);
  return restoreDocument(target.id);
}

// 여러 항목을 하나씩 차례로 처리 (실패하면 거기서 멈추고 오류 전달)
async function runInOrder(items: TrashItemDto[], action: (item: TrashItemDto) => Promise<void>): Promise<void> {
  for (const item of items) {
    await action(item);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// 원래 상위 페이지가 휴지통에 있어 원래 자리가 아닌 곳으로 복원되는 페이지
interface Relocation {
  name: string;
  parent: string;
  location: string;
}

// 선택 복원 순서: 함께 고른 휴지통 속 상위 페이지를 먼저 복원해야 하위가 원래 자리로 돌아감
// relocations: 상위를 함께 고르지 않아 다른 자리로 복원될 페이지
function planRestoreMany(items: TrashItemDto[]): { ordered: TrashItemDto[]; relocations: Relocation[] } {
  const selectedDocIds = new Set(items.filter((item) => item.kind === "document").map((item) => item.id));
  const followsParent = (item: TrashItemDto) => item.trashedParentId != null && selectedDocIds.has(item.trashedParentId);
  const ordered = [...items.filter((item) => !followsParent(item)), ...items.filter(followsParent)];
  const relocations = items
    .filter((item) => item.trashedParent && !followsParent(item))
    .map((item) => ({ name: item.name, parent: item.trashedParent as string, location: item.location }));
  return { ordered, relocations };
}

interface RestoreConfirmProps {
  relocations: Relocation[] | null;
  onClose: () => void;
  onConfirm: () => void;
}

// 원래 자리가 아닌 곳으로 복원될 때 어디로 들어가는지 확인 받는 창
function RestoreConfirmModal({ relocations, onClose, onConfirm }: RestoreConfirmProps) {
  // 닫히는 동안에도 문구를 유지
  const shown = useLastValue(relocations) ?? [];
  const [single] = shown;
  return (
    <Modal opened={relocations !== null} onClose={onClose} title="복원 위치 안내" centered>
      <Stack>
        {shown.length === 1 ? (
          <Text size="sm">
            "{single.name}" 페이지는 원래 상위 페이지({single.parent})가 휴지통에 있어 "{single.location}" 아래로 복원됩니다.
          </Text>
        ) : (
          <Stack gap={6}>
            <Text size="sm">다음 페이지는 원래 상위 페이지가 휴지통에 있어 원래 자리가 아닌 곳으로 복원됩니다.</Text>
            {shown.map((relocation) => (
              <Text key={`${relocation.name}-${relocation.location}`} size="sm" c="dimmed">
                "{relocation.name}" → "{relocation.location}" 아래
              </Text>
            ))}
          </Stack>
        )}
        <Text size="xs" c="dimmed">나중에 상위 페이지를 복원해도 이 페이지는 그 아래로 돌아가지 않습니다.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button onClick={onConfirm} data-autofocus>복원</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface TrashRowProps {
  item: TrashItemDto;
  checked: boolean;
  expanded: boolean;
  busy: boolean;
  pending: RestoreTarget | undefined;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  // 원래 상위가 휴지통에 있어 다른 자리로 복원되면 그 안내를 함께 넘김
  onRestore: (target: RestoreTarget, relocation?: Relocation) => void;
  onPurge: (item: TrashItemDto) => void;
}

// 삭제된 항목 한 줄과 펼쳤을 때 그 아래 함께 숨겨진 하위 페이지들
// 하위만 복원하면 가장 가까운 살아 있는 상위 페이지 아래로 옮겨짐 (그 하위도 함께)
function TrashRow({ item, checked, expanded, busy, pending, onToggleCheck, onToggleExpand, onRestore, onPurge }: TrashRowProps) {
  const isPending = (kind: RestoreTarget["kind"], id: number) => pending?.kind === kind && pending.id === id;
  // 삭제된 프로젝트 안의 페이지는 둘 곳이 없어 프로젝트 복원이 먼저
  const childBlocked = item.kind === "space";
  const hasChildren = item.children.length > 0;
  const group = groupOf(item);
  return (
    <>
      <Table.Tr bg={checked ? "var(--mantine-primary-color-light)" : undefined}>
        <Table.Td>
          <Checkbox size="xs" aria-label={`${item.name} 선택`} checked={checked} onChange={onToggleCheck} />
        </Table.Td>
        <Table.Td>
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            {hasChildren ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`${item.name} 하위 페이지 ${expanded ? "접기" : "펼치기"}`}
                aria-expanded={expanded}
                onClick={onToggleExpand}
              >
                <span style={{ display: "inline-flex", transition: "transform 150ms", transform: expanded ? "rotate(90deg)" : undefined }}>
                  <ChevronLineIcon direction="right" size={14} />
                </span>
              </ActionIcon>
            ) : (
              <Box w={22} style={{ flex: "none" }} />
            )}
            {/* 공유 보관함 파일은 보관함 목록과 같은 파일 종류 아이콘 */}
            <span style={{ display: "inline-flex", flex: "none", color: item.kind === "form" ? "var(--mantine-color-dimmed)" : undefined }}>
              {item.kind === "form" ? <FileKindIcon fileName={item.name} /> : <PageIcon icon={item.icon} project={item.spaceKind === "PROJECT"} />}
            </span>
            <Text size="sm" truncate>{item.name}</Text>
            {hasChildren && (
              <Text span size="xs" c="dimmed" style={{ flex: "none", fontVariantNumeric: "tabular-nums" }}>하위 {item.children.length}</Text>
            )}
          </Group>
        </Table.Td>
        <Table.Td><Text size="sm" c="dimmed">{FILTER_LABELS[group]}</Text></Table.Td>
        <Table.Td><Text size="sm" c="dimmed" truncate maw={220}>{item.location}</Text></Table.Td>
        <Table.Td><Text size="sm" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateTime(item.deletedAt)}</Text></Table.Td>
        <Table.Td>
          <Group gap={2} justify="flex-end" wrap="nowrap">
            <Button
              size="compact-sm"
              variant="subtle"
              fw={400}
              disabled={busy}
              loading={isPending(item.kind, item.id)}
              onClick={() => onRestore(
                { kind: item.kind, id: item.id },
                item.trashedParent ? { name: item.name, parent: item.trashedParent, location: item.location } : undefined,
              )}
            >
              복원
            </Button>
            <Button
              className="trash-danger"
              size="compact-sm"
              variant="subtle"
              color="gray"
              fw={400}
              disabled={busy}
              aria-label={`${item.name} 영구 삭제`}
              onClick={() => onPurge(item)}
            >
              영구 삭제
            </Button>
          </Group>
        </Table.Td>
      </Table.Tr>
      {expanded && item.children.map((child) => (
        <Table.Tr key={child.id} data-testid={`trash-child-${child.id}`} data-depth={child.depth} bg="var(--mantine-color-default-hover)">
          <Table.Td />
          <Table.Td colSpan={4}>
            <Group gap={6} wrap="nowrap" pl={28 + (child.depth - 1) * INDENT} style={{ minWidth: 0 }}>
              <span style={{ display: "inline-flex", flex: "none" }}><PageIcon icon={child.icon} /></span>
              <Text size="sm" c="dimmed" truncate>{child.title}</Text>
            </Group>
          </Table.Td>
          <Table.Td>
            <Group justify="flex-end">
              <Tooltip
                label={childBlocked ? "상위 프로젝트를 먼저 복원하세요" : "이 페이지만 꺼내 가장 가까운 상위 페이지 아래로 복원"}
                withArrow
                openDelay={300}
              >
                {/* 비활성 버튼에도 툴팁이 뜨도록 감싸기 */}
                <span>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    fw={400}
                    aria-label={`${child.title} 복원`}
                    disabled={childBlocked || busy}
                    loading={isPending("document", child.id)}
                    onClick={() => onRestore(
                      { kind: "document", id: child.id },
                      { name: child.title, parent: item.name, location: item.location },
                    )}
                  >
                    이 페이지만 복원
                  </Button>
                </span>
              </Tooltip>
            </Group>
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

// 영구 삭제 확인 대상: 한 항목, 선택한 여러 항목, 휴지통 전체
interface PurgeRequest {
  items: TrashItemDto[];
  emptyAll: boolean;
}

interface PurgeModalProps {
  request: PurgeRequest | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

const PURGE_WARNING = "하위 페이지, 수정 이력, 첨부 파일과 이미지까지 모두 지워지며 되돌릴 수 없습니다.";

function purgeMessage(request: PurgeRequest | null): string {
  if (!request || request.items.length === 0) return "";
  if (request.emptyAll) return `휴지통의 항목 ${request.items.length}개를 모두 영구 삭제할까요? ${PURGE_WARNING}`;
  if (request.items.length > 1) return `선택한 항목 ${request.items.length}개를 영구 삭제할까요? ${PURGE_WARNING}`;
  const [item] = request.items;
  return item.kind === "form"
    ? `"${item.name}" 파일을 영구 삭제할까요? 파일이 완전히 지워지며 되돌릴 수 없습니다.`
    : `"${item.name}" 페이지를 영구 삭제할까요? ${PURGE_WARNING}`;
}

// 영구 삭제 확인 창 (하위 페이지와 첨부 파일까지 지워져 되돌릴 수 없음을 안내)
function PurgeModal({ request, pending, error, onClose, onConfirm }: PurgeModalProps) {
  // 닫히는 동안에도 문구를 유지
  const shown = useLastValue(request);
  return (
    <Modal opened={request !== null} onClose={onClose} title={shown?.emptyAll ? "휴지통 비우기" : "영구 삭제"} centered>
      <Stack>
        <Text size="sm">{purgeMessage(shown)}</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          {/* 다른 삭제 확인 창과 같이 영구 삭제 버튼에 포커스를 두어 Enter로 확정 */}
          <Button color="red" loading={pending} onClick={onConfirm} data-autofocus>영구 삭제</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TrashPage() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["trash"], queryFn: getTrash });
  const [filter, setFilter] = useState<TrashFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [purgeRequest, setPurgeRequest] = useState<PurgeRequest | null>(null);
  // 다른 자리로 복원되는 경우 확인 창 문구와 확인 시 할 복원
  const [restoreConfirm, setRestoreConfirm] = useState<{ relocations: Relocation[]; run: () => void } | null>(null);

  // 휴지통·사이드바·문서 목록·검색 결과 갱신
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trash"] });
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
    queryClient.invalidateQueries({ queryKey: FORMS_KEY });
  };

  const restore = useMutation({
    mutationFn: restoreItem,
    onSuccess: refresh,
  });
  // 선택한 항목 복원 (중간에 실패해도 이미 복원한 항목이 보이도록 항상 갱신)
  const restoreMany = useMutation({
    mutationFn: (items: TrashItemDto[]) => runInOrder(items, (item) => restoreItem({ kind: item.kind, id: item.id })),
    onSuccess: () => setSelected(new Set()),
    onSettled: refresh,
  });
  const purge = useMutation({
    mutationFn: (request: PurgeRequest) => runInOrder(request.items, (item) => purgeTrashItem(item.kind, item.id)),
    onSuccess: () => {
      setPurgeRequest(null);
      setSelected(new Set());
    },
    onSettled: refresh,
  });

  const pending = restore.isPending ? restore.variables : undefined;
  const busy = restoreMany.isPending || purge.isPending;
  const items = data?.items ?? [];
  const trimmedQuery = query.trim();
  const visible = items.filter((item) => (filter === "all" || groupOf(item) === filter) && matchesQuery(item, trimmedQuery));
  // 지금 보이는 항목 중 선택한 것만 일괄 작업 대상
  const selectedItems = visible.filter((item) => selected.has(keyOf(item)));
  const allChecked = visible.length > 0 && selectedItems.length === visible.length;
  const counts: Record<TrashFilter, number> = {
    all: items.length,
    project: items.filter((item) => groupOf(item) === "project").length,
    page: items.filter((item) => groupOf(item) === "page").length,
    file: items.filter((item) => groupOf(item) === "file").length,
  };

  const toggleIn = (setter: typeof setSelected, key: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((item) => (allChecked ? next.delete(keyOf(item)) : next.add(keyOf(item))));
      return next;
    });
  };

  const openPurge = (request: PurgeRequest) => {
    purge.reset();
    setPurgeRequest(request);
  };

  // 원래 자리로 돌아가면 바로 복원, 다른 자리로 가면 위치를 알리고 확인 후 복원
  const requestRestore = (target: RestoreTarget, relocation?: Relocation) => {
    if (!relocation) {
      restore.mutate(target);
      return;
    }
    setRestoreConfirm({ relocations: [relocation], run: () => restore.mutate(target) });
  };

  const requestRestoreMany = () => {
    const { ordered, relocations } = planRestoreMany(selectedItems);
    if (relocations.length === 0) {
      restoreMany.mutate(ordered);
      return;
    }
    setRestoreConfirm({ relocations, run: () => restoreMany.mutate(ordered) });
  };

  const actionError = restore.error ?? restoreMany.error;

  return (
    <>
      <Group justify="space-between" align="center" mb="md" gap="sm">
        <Title order={3}>휴지통</Title>
        <Button
          className="trash-danger"
          variant="subtle"
          color="gray"
          fw={400}
          leftSection={<TrashIcon />}
          disabled={items.length === 0 || busy}
          onClick={() => openPurge({ items, emptyAll: true })}
        >
          휴지통 비우기
        </Button>
      </Group>
      {error && <Alert color="red" mb="sm">휴지통을 불러오지 못했습니다.</Alert>}
      {actionError && <Alert color="red" mb="sm">{errorMessage(actionError, "복원하지 못했습니다.")}</Alert>}
      <Group justify="space-between" mb="sm" gap="sm">
        <SegmentedControl
          size="sm"
          aria-label="종류 필터"
          value={filter}
          onChange={(value) => setFilter(value as TrashFilter)}
          data={(Object.keys(FILTER_LABELS) as TrashFilter[]).map((value) => ({
            value,
            label: `${FILTER_LABELS[value]} ${counts[value]}`,
          }))}
        />
        <Group gap="xs" wrap="wrap">
          {/* 선택 해제는 체크박스로, 선택이 있을 때만 일괄 작업을 검색 칸 옆에 보임 */}
          {selectedItems.length > 0 && (
            <>
              <Text size="sm" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>{selectedItems.length}개 선택됨</Text>
              {/* 표 줄의 복원·영구 삭제와 같은 간격 */}
              <Group gap={2} wrap="nowrap">
                <Button size="compact-sm" variant="subtle" fw={400} loading={restoreMany.isPending} disabled={purge.isPending}
                  onClick={requestRestoreMany}>
                  선택 복원
                </Button>
                <Button className="trash-danger" size="compact-sm" variant="subtle" color="gray" fw={400} disabled={busy}
                  onClick={() => openPurge({ items: selectedItems, emptyAll: false })}>
                  선택 영구 삭제
                </Button>
              </Group>
            </>
          )}
          <TextInput
            aria-label="휴지통 검색"
            placeholder="이름으로 찾기"
            leftSection={<SearchLineIcon size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            w={280}
            maw="100%"
          />
        </Group>
      </Group>
      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        {items.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">휴지통이 비어 있습니다.</Text>
        ) : visible.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">조건에 맞는 항목이 없습니다.</Text>
        ) : (
          <Table.ScrollContainer minWidth={TABLE_MIN_WIDTH} type="native">
            <Table className="trash-table" verticalSpacing={8} highlightOnHover style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 84 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 176 }} />
              </colgroup>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Checkbox
                      size="xs"
                      aria-label="전체 선택"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                  </Table.Th>
                  <Table.Th>이름</Table.Th>
                  <Table.Th>종류</Table.Th>
                  <Table.Th>원래 위치</Table.Th>
                  <Table.Th>삭제 일시</Table.Th>
                  <Table.Th aria-label="동작" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((item) => {
                  const key = keyOf(item);
                  // 하위 페이지 제목으로 찾았으면 펼쳐서 보여줌
                  const childMatched = trimmedQuery !== "" && !item.name.toLowerCase().includes(trimmedQuery.toLowerCase());
                  return (
                    <Fragment key={key}>
                      <TrashRow
                        item={item}
                        checked={selected.has(key)}
                        expanded={expanded.has(key) || childMatched}
                        busy={busy}
                        pending={pending}
                        onToggleCheck={() => toggleIn(setSelected, key)}
                        onToggleExpand={() => toggleIn(setExpanded, key)}
                        onRestore={requestRestore}
                        onPurge={(target) => openPurge({ items: [target], emptyAll: false })}
                      />
                    </Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
      <Text size="xs" c="dimmed" mt="xs">영구 삭제하면 {PURGE_WARNING}</Text>
      <PurgeModal
        request={purgeRequest}
        pending={purge.isPending}
        error={purge.error ? errorMessage(purge.error, "영구 삭제하지 못했습니다.") : null}
        onClose={() => setPurgeRequest(null)}
        onConfirm={() => purgeRequest && purge.mutate(purgeRequest)}
      />
      <RestoreConfirmModal
        relocations={restoreConfirm?.relocations ?? null}
        onClose={() => setRestoreConfirm(null)}
        onConfirm={() => {
          restoreConfirm?.run();
          setRestoreConfirm(null);
        }}
      />
    </>
  );
}
