import { useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import {
  ActionIcon, Alert, Box, Button, Checkbox, Group, Loader, Menu, Modal, NumberInput, Popover, ScrollArea, Stack, Text,
  TextInput, Tooltip, UnstyledButton,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { LIVE_TOPICS, useLiveRefresh } from "../api/live";
import { listMembers } from "../api/members";
import type { MemberDto } from "../api/members";
import { createWbsTask, deleteWbsTask, getWbs, moveWbsTask, updateWbsTask } from "../api/wbs";
import type { WbsDto, WbsRowDto, WbsTaskInput } from "../api/wbs";
import { dropSlotAt } from "../documents/dropSlot";
import { useElementSize } from "@mantine/hooks";
import {
  addDays, daysBetween, descendantIdsOf, dropTargetAt, ganttDays, monthSpans, percent, siblingsOf, todayString,
} from "./wbsTree";
import type { WbsDropTarget } from "./wbsTree";
import type { GanttDay } from "./wbsTree";

// 표와 간트 차트가 같은 높이를 쓰도록 고정
const ROW_H = 36;
const HEADER_H = 52;
const DAY_W = 22;
const INDENT = 16;
// 맨 앞 ⋯ 메뉴 칸 폭 (작업명 칸이 시작하는 위치 계산에 사용)
const MENU_W = 30;

type ColumnKey = "name" | "assignees" | "start" | "end" | "actualPercent"
  | "workdays" | "days" | "weight" | "plannedPercent" | "plannedTotal" | "actualTotal" | "menu";

interface Column {
  key: ColumnKey;
  label: ReactNode;
  width: number;
  align?: "left" | "right" | "center";
  // 서버가 계산하는 열 (직접 입력하는 열 뒤에 옅은 배경으로 구분)
  computed?: boolean;
}

// 작업 메뉴와 직접 입력하는 열을 앞에, 계산되는 열을 뒤에 배치 (끌기 손잡이는 줄 왼쪽 테두리에 표시)
const COLUMNS: Column[] = [
  { key: "menu", label: "", width: MENU_W },
  { key: "name", label: "작업명", width: 240 },
  { key: "assignees", label: "담당자", width: 120 },
  { key: "start", label: "시작", width: 120 },
  { key: "end", label: "완료", width: 120 },
  { key: "actualPercent", label: <>실적<br />(개별)</>, width: 70, align: "right" },
  { key: "workdays", label: "작업일", width: 52, align: "right", computed: true },
  { key: "days", label: "기간", width: 46, align: "right", computed: true },
  { key: "weight", label: "가중치", width: 56, align: "right", computed: true },
  { key: "plannedPercent", label: <>계획<br />(개별)</>, width: 62, align: "right", computed: true },
  { key: "plannedTotal", label: <>계획<br />(전체)</>, width: 62, align: "right", computed: true },
  { key: "actualTotal", label: <>실적<br />(전체)</>, width: 62, align: "right", computed: true },
];

const FIRST_COMPUTED = COLUMNS.find((c) => c.computed)!.key;
const TABLE_W = COLUMNS.reduce((sum, c) => sum + c.width, 0);

const BORDER = "1px solid var(--mantine-color-default-border)";
const COMPUTED_BG = "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))";

function cellStyle(key: ColumnKey): CSSProperties {
  const column = COLUMNS.find((c) => c.key === key)!;
  return {
    width: column.width,
    flex: `0 0 ${column.width}px`,
    padding: "0 6px",
    display: "flex",
    alignItems: "center",
    justifyContent: column.align === "right" ? "flex-end" : column.align === "center" ? "center" : "flex-start",
    overflow: "hidden",
    whiteSpace: "nowrap",
    fontSize: 13,
    background: column.computed ? COMPUTED_BG : undefined,
    borderLeft: key === FIRST_COMPUTED ? BORDER : undefined,
    color: column.computed ? "var(--mantine-color-dimmed)" : undefined,
  };
}

// 열 순서대로 칸을 그림 (칸별 내용과 추가 스타일)
function Cells({ content, extra = {} }: {
  content: Partial<Record<ColumnKey, ReactNode>>;
  extra?: Partial<Record<ColumnKey, CSSProperties>>;
}) {
  return (
    <>
      {COLUMNS.map((column) => (
        <Box key={column.key} style={{ ...cellStyle(column.key), ...extra[column.key] }}>
          {content[column.key]}
        </Box>
      ))}
    </>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  height: ROW_H,
  boxSizing: "border-box",
  borderBottom: BORDER,
};

// 하위 작업이 있는 줄은 날짜·진척률을 계산값으로만 보여줌
function inputOf(row: WbsRowDto): WbsTaskInput {
  return {
    name: row.name,
    startDate: row.hasChildren ? null : row.startDate,
    endDate: row.hasChildren ? null : row.endDate,
    progress: row.hasChildren ? 0 : row.actualPercent,
    assigneeIds: row.assignees.map((a) => a.id),
  };
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface Props {
  documentId: number;
}

// WBS 화면 본문: 왼쪽 작업 표 + 오른쪽 일 단위 간트 차트
export function WbsBoard({ documentId }: Props) {
  const queryClient = useQueryClient();
  // 보는 사람마다 고르는 기준일 (저장하지 않음, 기본값 오늘)
  const [baseDate, setBaseDate] = useState(todayString());
  const { data, error, isPending } = useQuery({
    queryKey: ["wbs", documentId, baseDate],
    queryFn: () => getWbs(documentId, baseDate),
    placeholderData: (previous) => previous,
  });
  const { data: members = [] } = useQuery({ queryKey: ["members", false], queryFn: () => listMembers(false) });
  // 다른 팀원이 고친 작업을 바로 반영
  useLiveRefresh(LIVE_TOPICS.wbs, [["wbs", documentId]]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["wbs", documentId] });
  const create = useMutation({
    mutationFn: ({ parentId, index }: { parentId: number | null; index?: number }) =>
      createWbsTask(documentId, parentId, index),
    onSettled: refresh,
  });
  // 맨 아래 빈 줄에 작업명을 입력하면 최상위 맨 아래에 그 이름으로 작업 생성
  const addNamed = useMutation({
    mutationFn: async (name: string) => {
      const id = await createWbsTask(documentId, null);
      await updateWbsTask(id, { name, startDate: null, endDate: null, progress: 0, assigneeIds: [] });
    },
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: WbsTaskInput }) => updateWbsTask(id, input),
    onSettled: refresh,
  });
  const move = useMutation({
    mutationFn: ({ id, parentId, index }: { id: number; parentId: number | null; index?: number }) =>
      moveWbsTask(id, parentId, index),
    onSettled: refresh,
  });
  const [deleteTarget, setDeleteTarget] = useState<WbsRowDto | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => deleteWbsTask(id),
    onSuccess: () => setDeleteTarget(null),
    onSettled: refresh,
  });

  // 끌고 있는 작업과 놓일 위치, 손잡이를 보일 줄
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  // 놓일 위치와 그 위치를 표시할 가로선의 세로 위치(작업 줄 목록 기준 px)
  const [drop, setDrop] = useState<(WbsDropTarget & { top: number }) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  if (error && !data) return <Alert color="red">{errorText(error, "WBS를 불러오지 못했습니다.")}</Alert>;
  if (isPending || !data) return <Loader size="sm" />;

  const rows = data.tasks;
  const save = (row: WbsRowDto, patch: Partial<WbsTaskInput>) => {
    if (row.id === null) return;
    update.mutate({ id: row.id, input: { ...inputOf(row), ...patch } });
  };
  const addAround = (row: WbsRowDto, where: "above" | "below" | "child") => {
    if (where === "child") {
      create.mutate({ parentId: row.id });
      return;
    }
    const index = siblingsOf(rows, row.parentId).findIndex((r) => r.id === row.id);
    create.mutate({ parentId: row.parentId, index: where === "above" ? index : index + 1 });
  };

  // 노션식 끌기: 목록 어디서든 가장 가까운 줄 사이를 고르고, 마우스 가로 위치로 단계를 정함
  // (오른쪽으로 끌면 윗줄의 하위 작업, 왼쪽으로 끌면 상위 단계)
  const dropTargetOf = (e: DragEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (draggingId === null || !list) return null;
    const moving = descendantIdsOf(rows, draggingId).add(draggingId);
    const rects = Array.from(list.querySelectorAll<HTMLElement>(".wbs-row"))
      .filter((el) => !moving.has(Number(el.dataset.rowId)))
      .map((el) => el.getBoundingClientRect());
    const listTop = list.getBoundingClientRect().top;
    const slot = dropSlotAt(e.clientY, rects);
    // 작업명 칸의 글자 시작 위치를 0단계로 보고 들여쓰기 폭마다 한 단계
    const nameLeft = (rects[0]?.left ?? list.getBoundingClientRect().left) + MENU_W + 6;
    const target = dropTargetAt(rows, draggingId, slot, (e.clientX - nameLeft) / INDENT);
    const lineY = slot < rects.length ? rects[slot].top : rects.length > 0 ? rects[rects.length - 1].bottom : listTop;
    return { ...target, top: lineY - listTop };
  };
  const listDragHandlers = {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      const target = dropTargetOf(e);
      if (!target) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDrop(target);
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      // 목록 안의 다른 요소로 옮겨 갈 때는 가로선 유지
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(null);
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      const target = dropTargetOf(e);
      setDrop(null);
      if (!target || draggingId === null) return;
      e.preventDefault();
      move.mutate({ id: draggingId, parentId: target.parentId, index: target.index });
      setDraggingId(null);
    },
  };

  const mutationError = create.error ?? addNamed.error ?? update.error ?? move.error;

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Text size="sm" c="dimmed">기준일</Text>
          <TextInput
            type="date"
            size="xs"
            aria-label="기준일"
            value={baseDate}
            onChange={(e) => {
              if (e.currentTarget.value) setBaseDate(e.currentTarget.value);
            }}
          />
          {baseDate !== todayString() && (
            <Button size="compact-xs" variant="subtle" onClick={() => setBaseDate(todayString())}>오늘</Button>
          )}
        </Group>
      </Group>
      {mutationError && <Alert color="red">{errorText(mutationError, "저장하지 못했습니다.")}</Alert>}
      {/* 왼쪽 테두리 위의 끌기 손잡이가 잘리지 않도록 바깥 상자는 내용을 자르지 않음 */}
      <Box pos="relative" style={{ display: "flex", border: BORDER, borderRadius: 8 }}>
        {/* 끌기 손잡이는 가로 스크롤과 상관없이 테두리선 위에 고정 (스크롤되는 표 밖의 별도 층) */}
        <Box pos="absolute" left={0} top={HEADER_H + ROW_H} w={0} style={{ zIndex: 3 }}>
          {rows.map((row, i) => (
            <button
              key={row.id}
              type="button"
              className="member-drag-handle wbs-drag-handle"
              data-visible={hoveredId === row.id || undefined}
              style={{ top: i * ROW_H + ROW_H / 2 }}
              aria-label={`${row.name} 끌어서 순서 변경`}
              title="끌어서 순서·단계 변경"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.clearData();
                e.dataTransfer.setData("application/x-portal-wbs-task", String(row.id));
                e.dataTransfer.effectAllowed = "move";
                const rowEl = document.querySelector<HTMLElement>(`[data-testid="wbs-row-${row.id}"]`);
                if (rowEl) e.dataTransfer.setDragImage?.(rowEl, 16, ROW_H / 2);
                setDraggingId(row.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDrop(null);
              }}
            >
              ⠿
            </button>
          ))}
        </Box>
        {/* 스크롤바가 마지막 줄을 덮지 않도록 기본 가로 스크롤(얇게) 사용, 내용은 테두리 안에서 잘림 */}
        <Box className="wbs-scroll" style={{ flex: "0 1 auto", maxWidth: "62%", borderTopLeftRadius: 7, borderBottomLeftRadius: 7, display: "flex", flexDirection: "column" }}>
          {/* 오른쪽 일정 칸에 가로 스크롤바가 생겨 더 높아져도 왼쪽 표가 같은 높이까지 이어지도록 세로로 늘림 */}
          <Box w={TABLE_W} style={{ flex: "1 0 auto", display: "flex", flexDirection: "column" }}>
            <Box style={{ ...rowStyle, height: HEADER_H, background: "var(--mantine-color-default-hover)", borderTopLeftRadius: 7 }}>
              {COLUMNS.map((column) => (
                <Box key={column.key} style={{ ...cellStyle(column.key), justifyContent: "center", fontWeight: 600, fontSize: 12, textAlign: "center", lineHeight: 1.2 }}>
                  {column.label}
                </Box>
              ))}
            </Box>
            <SummaryRow row={data.summary} />
            {/* 작업 줄과 맨 아래 빈 줄 전체가 놓기 영역 */}
            <Box ref={listRef} pos="relative" data-testid="wbs-task-list" {...listDragHandlers}>
              {rows.map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  members={members}
                  dragging={draggingId !== null && (row.id === draggingId || descendantIdsOf(rows, draggingId).has(row.id as number))}
                  onSave={(patch) => save(row, patch)}
                  onAdd={(where) => addAround(row, where)}
                  onDelete={() => setDeleteTarget(row)}
                  onHover={(hovered) => setHoveredId(hovered ? row.id : null)}
                />
              ))}
              <NewTaskRow onCommit={(name) => addNamed.mutate(name)} />
              {/* 놓일 자리: 들어갈 단계만큼 들여 쓴 가로선 */}
              {drop && (
                <Box
                  data-testid="wbs-drop-line"
                  data-depth={drop.depth}
                  style={{
                    position: "absolute", top: drop.top - 1, left: MENU_W + 6 + drop.depth * INDENT, right: 0, height: 2,
                    background: "var(--mantine-primary-color-filled)", pointerEvents: "none", zIndex: 2,
                  }}
                />
              )}
            </Box>
            {/* 표 아래 남는 높이: 계산 열의 회색 배경과 구분선만 바닥까지 이어 그림 */}
            <Box aria-hidden data-testid="wbs-filler" style={{ display: "flex", flex: "1 0 0" }}>
              {COLUMNS.map((column) => <Box key={column.key} style={cellStyle(column.key)} />)}
            </Box>
          </Box>
        </Box>
        <Gantt data={data} />
      </Box>
      <DeleteTaskModal
        row={deleteTarget}
        pending={remove.isPending}
        error={remove.error ? errorText(remove.error, "삭제하지 못했습니다.") : null}
        onClose={() => {
          setDeleteTarget(null);
          remove.reset();
        }}
        onConfirm={() => deleteTarget?.id != null && remove.mutate(deleteTarget.id)}
      />
    </Stack>
  );
}

// 계산되는 열의 내용 (작업 줄과 전체 합계 줄 공통)
function computedContent(row: WbsRowDto): Partial<Record<ColumnKey, ReactNode>> {
  return {
    workdays: row.workdays || "",
    days: row.calendarDays || "",
    weight: row.weight.toFixed(1),
    plannedPercent: percent(row.plannedPercent),
    plannedTotal: percent(row.plannedTotal),
    actualTotal: percent(row.actualTotal),
  };
}

// 전체 합계 줄은 계산 열도 흐리지 않고 굵게 표시
const SUMMARY_EXTRA: Partial<Record<ColumnKey, CSSProperties>> = Object.fromEntries(
  COLUMNS.filter((c) => c.computed).map((c) => [c.key, { color: "inherit" }]),
);

// 맨 위 전체 합계 줄
function SummaryRow({ row }: { row: WbsRowDto }) {
  return (
    <Box style={{ ...rowStyle, fontWeight: 700, background: "var(--mantine-color-default-hover)" }} data-testid="wbs-summary">
      <Cells
        content={{
          name: "전체",
          start: row.startDate ?? "",
          end: row.endDate ?? "",
          actualPercent: percent(row.actualPercent),
          ...computedContent(row),
        }}
        extra={SUMMARY_EXTRA}
      />
    </Box>
  );
}

interface TaskRowProps {
  row: WbsRowDto;
  members: MemberDto[];
  // 끌고 있는 작업(과 그 하위)이면 흐리게 표시
  dragging: boolean;
  onSave: (patch: Partial<WbsTaskInput>) => void;
  onAdd: (where: "above" | "below" | "child") => void;
  onDelete: () => void;
  // 마우스를 올린 줄의 끌기 손잡이 표시
  onHover: (hovered: boolean) => void;
}

// 작업 한 줄: 칸을 눌러 바로 고치고 Enter나 포커스 이동으로 저장
function TaskRow({ row, members, dragging, onSave, onAdd, onDelete, onHover }: TaskRowProps) {
  const group = row.hasChildren;
  return (
    <Box
      className="wbs-row"
      data-testid={`wbs-row-${row.id}`}
      data-row-id={row.id ?? undefined}
      style={{ ...rowStyle, fontWeight: group ? 600 : undefined, opacity: dragging ? 0.4 : undefined }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <Cells
        extra={{
          name: { paddingLeft: 6 + row.depth * INDENT },
          menu: { padding: 0, justifyContent: "center" },
        }}
        content={{
          name: (
            <TextCell value={row.name} ariaLabel="작업명" fontWeight={group ? 600 : 400}
              onCommit={(name) => onSave({ name })} />
          ),
          assignees: <AssigneeCell row={row} members={members} onChange={(assigneeIds) => onSave({ assigneeIds })} />,
          // 하위 작업이 있으면 날짜·실적은 하위에서 계산한 값만 표시
          start: group ? row.startDate ?? "" : (
            <DateCell value={row.startDate} ariaLabel={`${row.name} 시작일`} onCommit={(startDate) => onSave({ startDate })} />
          ),
          end: group ? row.endDate ?? "" : (
            <DateCell value={row.endDate} ariaLabel={`${row.name} 완료일`} onCommit={(endDate) => onSave({ endDate })} />
          ),
          actualPercent: group ? percent(row.actualPercent) : (
            <ProgressCell value={row.actualPercent} ariaLabel={`${row.name} 실적`} onCommit={(progress) => onSave({ progress })} />
          ),
          ...computedContent(row),
          menu: (
            <Menu position="bottom-start" withinPortal>
              <Menu.Target>
                <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`${row.name} 메뉴`}>⋯</ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => onAdd("above")}>위에 작업 추가</Menu.Item>
                <Menu.Item onClick={() => onAdd("below")}>아래에 작업 추가</Menu.Item>
                <Menu.Item onClick={() => onAdd("child")}>하위 작업 추가</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={onDelete}>작업 삭제</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ),
        }}
      />
    </Box>
  );
}

// 표 맨 아래 빈 입력 줄: 작업명을 입력하고 Enter나 포커스 이동으로 새 작업 생성, Enter면 같은 칸에서 이어서 입력
function NewTaskRow({ onCommit }: { onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const name = draft.trim();
    if (!name) return;
    onCommit(name);
    setDraft("");
  };
  return (
    <Box style={{ ...rowStyle, borderBottom: "none" }} data-testid="wbs-new-row">
      <Cells
        content={{
          name: (
            <TextInput
              variant="unstyled"
              size="xs"
              w="100%"
              maxLength={200}
              placeholder="+ 작업 입력"
              aria-label="새 작업명"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") setDraft("");
              }}
              styles={{ input: { fontSize: 13 } }}
            />
          ),
        }}
      />
    </Box>
  );
}

// 글자 칸: 비어 있거나 바뀌지 않으면 저장하지 않음
function TextCell({ value, ariaLabel, fontWeight, onCommit }: {
  value: string; ariaLabel: string; fontWeight: number; onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    setDraft(null);
  };
  return (
    <TextInput
      variant="unstyled"
      size="xs"
      w="100%"
      maxLength={200}
      aria-label={ariaLabel}
      value={draft ?? value}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      styles={{ input: { fontWeight, fontSize: 13 } }}
    />
  );
}

// 날짜 칸: 고르면 바로 저장, 지우면 날짜 없음
function DateCell({ value, ariaLabel, onCommit }: {
  value: string | null; ariaLabel: string; onCommit: (value: string | null) => void;
}) {
  return (
    <TextInput
      type="date"
      variant="unstyled"
      size="xs"
      w="100%"
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(e) => {
        const next = e.currentTarget.value || null;
        if (next !== value) onCommit(next);
      }}
      styles={{ input: { fontSize: 13 } }}
    />
  );
}

// 실적 진척률 칸 (0~100, 소수 첫째 자리)
function ProgressCell({ value, ariaLabel, onCommit }: {
  value: number; ariaLabel: string; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | number | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = typeof draft === "number" ? draft : Number(draft || 0);
    if (Number.isFinite(next) && next !== value) onCommit(Math.min(100, Math.max(0, next)));
    setDraft(null);
  };
  return (
    <NumberInput
      variant="unstyled"
      size="xs"
      w="100%"
      hideControls
      min={0}
      max={100}
      decimalScale={1}
      clampBehavior="strict"
      suffix="%"
      aria-label={ariaLabel}
      value={draft ?? value}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      styles={{ input: { fontSize: 13, textAlign: "right" } }}
    />
  );
}

// 담당자 칸: 이름을 이어서 보여주고, 누르면 팀원을 여러 명 고르는 목록
function AssigneeCell({ row, members, onChange }: {
  row: WbsRowDto; members: MemberDto[]; onChange: (ids: number[]) => void;
}) {
  const selected = row.assignees.map((a) => String(a.id));
  const label = row.assignees.map((a) => a.name).join(", ");
  // 삭제된 팀원이 이미 지정돼 있으면 목록에 이름만 남겨 둠
  const options = [
    ...members.map((m) => ({ id: m.id, name: m.name })),
    ...row.assignees.filter((a) => !members.some((m) => m.id === a.id)),
  ];
  return (
    <Popover position="bottom-start" withinPortal shadow="md" width={200}>
      <Popover.Target>
        <Tooltip label={label} disabled={!label} openDelay={400} withArrow>
          <UnstyledButton aria-label={`${row.name} 담당자`} style={{ width: "100%", textAlign: "left", fontSize: 13 }}>
            <Text size="sm" truncate c={label ? undefined : "dimmed"} fz={13}>{label || "-"}</Text>
          </UnstyledButton>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Checkbox.Group value={selected} onChange={(values) => onChange(values.map(Number))}>
          <ScrollArea.Autosize mah={240}>
            <Stack gap={6}>
              {options.map((m) => (
                <Checkbox key={m.id} value={String(m.id)} label={m.name || "(이름 없음)"} size="xs" />
              ))}
              {options.length === 0 && <Text size="xs" c="dimmed">팀원이 없습니다.</Text>}
            </Stack>
          </ScrollArea.Autosize>
        </Checkbox.Group>
      </Popover.Dropdown>
    </Popover>
  );
}

// 일 단위 간트 차트: 토·일·공휴일은 빨간 날짜, 기준일은 세로선
function Gantt({ data }: { data: WbsDto }) {
  // 서버 범위가 화면 폭보다 짧으면 남는 폭만큼 뒤 날짜를 더 그려 빈 공간을 없앰
  const { ref, width: boxWidth } = useElementSize();
  const serverDays = daysBetween(data.rangeStart, data.rangeEnd) + 1;
  const dayCount = Math.max(serverDays, Math.ceil(boxWidth / DAY_W));
  const days = ganttDays(data.rangeStart, addDays(data.rangeStart, dayCount - 1), data.holidays);
  const width = days.length * DAY_W;
  // 전체 합계 줄 + 작업 줄 + 맨 아래 빈 입력 줄
  const bodyHeight = ROW_H * (data.tasks.length + 2);
  const baseOffset = daysBetween(data.rangeStart, data.baseDate);
  const allRows = [data.summary, ...data.tasks];
  return (
    <Box ref={ref} className="wbs-scroll" style={{ flex: "1 1 0", minWidth: 0, borderLeft: BORDER, borderTopRightRadius: 7, borderBottomRightRadius: 7 }}>
      <Box w={width} pos="relative">
        <Box style={{ display: "flex", height: HEADER_H / 2, borderBottom: BORDER, background: "var(--mantine-color-default-hover)" }}>
          {monthSpans(days).map((span, i) => (
            <Box key={`${span.label}-${i}`} style={{ width: span.count * DAY_W, flex: "0 0 auto", fontSize: 12, fontWeight: 600, padding: "4px 6px", borderRight: BORDER, overflow: "hidden", whiteSpace: "nowrap", boxSizing: "border-box" }}>
              {span.label}
            </Box>
          ))}
        </Box>
        <Box style={{ display: "flex", height: HEADER_H / 2, borderBottom: BORDER, background: "var(--mantine-color-default-hover)" }}>
          {days.map((day) => <DayHeader key={day.date} day={day} />)}
        </Box>
        <Box pos="relative" h={bodyHeight}>
          {/* 쉬는 날 칸 배경과 기준일 세로선은 줄과 상관없이 한 번만 그림 */}
          {days.map((day, i) => day.off && (
            <Box key={day.date} style={{ position: "absolute", top: 0, bottom: 0, left: i * DAY_W, width: DAY_W, background: "var(--mantine-color-default-hover)" }} />
          ))}
          {baseOffset >= 0 && baseOffset < days.length && (
            <Box
              data-testid="wbs-base-line"
              title={`기준일 ${data.baseDate}`}
              style={{ position: "absolute", top: 0, bottom: 0, left: baseOffset * DAY_W + DAY_W / 2, width: 2, background: "var(--mantine-color-red-6)", zIndex: 2 }}
            />
          )}
          {allRows.map((row, i) => (
            <Box key={row.id ?? "summary"} style={{ position: "absolute", top: i * ROW_H, left: 0, right: 0, height: ROW_H, borderBottom: BORDER, boxSizing: "border-box",
              // 처음 그릴 때 막대가 위 줄부터 차례로 왼쪽에서 자라나도록 줄 순서 전달 (index.css .wbs-bar)
              ["--bar-order" as string]: Math.min(i, 12) }}>
              <GanttBar row={row} rangeStart={data.rangeStart} summary={row.id === null} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function DayHeader({ day }: { day: GanttDay }) {
  const cell = (
    <Box style={{ width: DAY_W, flex: "0 0 auto", fontSize: 11, textAlign: "center", lineHeight: `${HEADER_H / 2}px`, color: day.off ? "var(--mantine-color-red-6)" : undefined, boxSizing: "border-box" }}>
      {String(day.day).padStart(2, "0")}
    </Box>
  );
  return day.holidayName ? <Tooltip label={day.holidayName} withArrow openDelay={200}>{cell}</Tooltip> : cell;
}

// 세부 작업은 실적 비율만큼 앞부분을 진하게, 상위 작업·전체는 얇은 진한 막대
function GanttBar({ row, rangeStart, summary }: { row: WbsRowDto; rangeStart: string; summary: boolean }) {
  if (!row.startDate || !row.endDate) return null;
  const left = daysBetween(rangeStart, row.startDate) * DAY_W;
  const width = (daysBetween(row.startDate, row.endDate) + 1) * DAY_W;
  const title = `${row.name}: ${row.startDate} ~ ${row.endDate} · 실적 ${percent(row.actualPercent)}`;
  if (row.hasChildren || summary) {
    return (
      <Box title={title} data-testid={`wbs-bar-${row.id ?? "summary"}`} className="wbs-bar"
        style={{ position: "absolute", left, width, top: ROW_H / 2 - 4, height: 8, borderRadius: 2, background: "var(--mantine-color-gray-6)" }} />
    );
  }
  return (
    <Box title={title} data-testid={`wbs-bar-${row.id}`} className="wbs-bar"
      style={{ position: "absolute", left, width, top: 8, height: ROW_H - 17, borderRadius: 3, background: "var(--mantine-color-blue-light)", border: "1px solid var(--mantine-color-blue-4)", overflow: "hidden", boxSizing: "border-box" }}>
      <Box style={{ width: `${row.actualPercent}%`, height: "100%", background: "var(--mantine-color-blue-filled)" }} />
    </Box>
  );
}

// 작업 삭제 확인 창 (하위 작업도 함께 지워지며 휴지통에 가지 않음)
function DeleteTaskModal({ row, pending, error, onClose, onConfirm }: {
  row: WbsRowDto | null; pending: boolean; error: string | null; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal opened={row !== null} onClose={onClose} title="작업 삭제" centered>
      <Stack>
        <Text size="sm">
          {`"${row?.name ?? ""}" 작업을 삭제할까요?${row?.hasChildren ? " 하위 작업도 함께 삭제되며" : ""} 되돌릴 수 없습니다.`}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          {/* 다른 삭제 확인 창과 같이 삭제 버튼에 포커스를 두어 Enter로 확정 */}
          <Button color="red" loading={pending} onClick={onConfirm} data-autofocus>삭제</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
