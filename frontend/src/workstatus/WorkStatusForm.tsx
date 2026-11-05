import { useState } from "react";
import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMembers } from "../api/members";
import { createWorkStatus, deleteWorkStatus, updateWorkStatus } from "../api/workStatuses";
import type { HalfDayPeriod, WorkStatusDto, WorkStatusRequest, WorkStatusType } from "../api/workStatuses";
import { TYPE_COLORS, TYPE_LABELS, TYPE_ORDER } from "./types";
import { DEFAULT_END_TIME, DEFAULT_START_TIME, buildTimeOptions } from "./timeOptions";

// 종류별 입력 규칙 (백엔드 WorkStatusValidator와 동일)
const RANGE_TYPES: WorkStatusType[] = ["LEAVE", "BUSINESS_TRIP", "OTHER"];
const TIME_TYPES: WorkStatusType[] = ["OUTSIDE_WORK", "OTHER"];
const PLACE_TYPES: WorkStatusType[] = ["BUSINESS_TRIP", "OUTSIDE_WORK"];

export interface WorkStatusFormProps {
  opened: boolean;
  onClose: () => void;
  // 수정 대상 (없으면 신규 등록)
  editing: WorkStatusDto | null;
  // 신규 등록 시 기본 날짜
  defaultDate: string;
  currentUserId: number | null;
}

function toTimeInput(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export function WorkStatusForm(props: WorkStatusFormProps) {
  // 열릴 때마다 초기값을 새로 잡도록 key로 내부 폼을 재생성
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={props.editing ? "근무 상황 수정" : "근무 상황 등록"} size="md">
      {props.opened && <FormBody key={props.editing?.id ?? `new-${props.defaultDate}`} {...props} />}
    </Modal>
  );
}

function FormBody({ onClose, editing, defaultDate, currentUserId }: WorkStatusFormProps) {
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["members", false], queryFn: () => listMembers(false) });

  const [memberId, setMemberId] = useState<string | null>(
    editing ? String(editing.memberId) : currentUserId !== null ? String(currentUserId) : null,
  );
  const [type, setType] = useState<WorkStatusType>(editing?.type ?? "LEAVE");
  const [startDate, setStartDate] = useState(editing?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(editing?.endDate ?? defaultDate);
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>(editing?.halfDayPeriod ?? "AM");
  // 신규 등록은 기본 근무 시간(09:00~18:00)으로 시작
  const [startTime, setStartTime] = useState(editing ? toTimeInput(editing.startTime) : DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(editing ? toTimeInput(editing.endTime) : DEFAULT_END_TIME);
  const [startTimeOptions] = useState(() => buildTimeOptions(editing ? toTimeInput(editing.startTime) : undefined));
  const [endTimeOptions] = useState(() => buildTimeOptions(editing ? toTimeInput(editing.endTime) : undefined));
  const [place, setPlace] = useState(editing?.place ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRange = RANGE_TYPES.includes(type);
  const showTimes = TIME_TYPES.includes(type);
  const showPlace = PLACE_TYPES.includes(type);

  const onDone = () => {
    queryClient.invalidateQueries({ queryKey: ["workStatuses"] });
    queryClient.invalidateQueries({ queryKey: ["annualLeaves"] });
    onClose();
  };
  const onError = (e: Error) => setErrorMessage(e.message);

  const save = useMutation({
    mutationFn: (body: WorkStatusRequest) => (editing ? updateWorkStatus(editing.id, body) : createWorkStatus(body)),
    onSuccess: onDone,
    onError,
  });
  const remove = useMutation({
    mutationFn: () => deleteWorkStatus(editing!.id),
    onSuccess: onDone,
    onError,
  });

  const submit = () => {
    setErrorMessage(null);
    // 종류에서 쓰지 않는 입력은 null로 전송
    save.mutate({
      memberId: Number(memberId),
      type,
      startDate,
      endDate: isRange ? endDate : startDate,
      halfDayPeriod: type === "HALF_DAY" || type === "QUARTER_DAY" ? halfDayPeriod : null,
      startTime: showTimes && startTime ? startTime : null,
      endTime: showTimes && endTime ? endTime : null,
      place: showPlace ? place.trim() || null : null,
      content: type === "OTHER" ? content.trim() || null : null,
    });
  };

  return (
    <Stack>
      <Select
        label="대상자"
        data={members.map((m) => ({ value: String(m.id), label: m.name }))}
        value={memberId}
        onChange={setMemberId}
        allowDeselect={false}
      />
      <div>
        <Text size="sm" fw={500} mb={4}>종류</Text>
        <Group gap={6}>
          {TYPE_ORDER.map((t) => (
            <Button
              key={t}
              size="xs"
              color={TYPE_COLORS[t]}
              variant={type === t ? "filled" : "light"}
              onClick={() => setType(t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </Group>
      </div>
      <Group grow>
        <TextInput
          type="date"
          label={isRange ? "시작일" : "날짜"}
          value={startDate}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setStartDate(value);
            if (!isRange || endDate < value) setEndDate(value);
          }}
        />
        {isRange && (
          <TextInput type="date" label="종료일" value={endDate} min={startDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
        )}
      </Group>
      {(type === "HALF_DAY" || type === "QUARTER_DAY") && (
        <Select
          label="오전/오후"
          data={[{ value: "AM", label: "오전" }, { value: "PM", label: "오후" }]}
          value={halfDayPeriod}
          onChange={(v) => v && setHalfDayPeriod(v as HalfDayPeriod)}
          allowDeselect={false}
        />
      )}
      {showTimes && (
        <Group grow>
          <Select
            label="시작 시간"
            data={startTimeOptions}
            value={startTime || null}
            onChange={(v) => setStartTime(v ?? "")}
            searchable
            clearable={type === "OTHER"}
            maxDropdownHeight={240}
          />
          <Select
            label="종료 시간"
            data={endTimeOptions}
            value={endTime || null}
            onChange={(v) => setEndTime(v ?? "")}
            searchable
            clearable={type === "OTHER"}
            maxDropdownHeight={240}
          />
        </Group>
      )}
      {showPlace && <TextInput label="장소" value={place} maxLength={100} onChange={(e) => setPlace(e.currentTarget.value)} />}
      {type === "OTHER" && <TextInput label="내용" value={content} maxLength={100} onChange={(e) => setContent(e.currentTarget.value)} />}
      {errorMessage && <Alert color="red">{errorMessage}</Alert>}
      {/* 삭제는 되돌릴 수 없으므로 한 번 더 확인 */}
      {confirmDelete && (
        <Alert color="red" title="이 근무 상황을 삭제할까요?">
          <Text size="sm" mb="xs">삭제하면 되돌릴 수 없습니다.</Text>
          <Group gap="xs">
            <Button size="xs" color="red" loading={remove.isPending} onClick={() => remove.mutate()}>삭제 확인</Button>
            <Button size="xs" variant="default" onClick={() => setConfirmDelete(false)}>아니오</Button>
          </Group>
        </Alert>
      )}
      <Group justify="space-between">
        {editing ? (
          <Button color="red" variant="subtle" disabled={confirmDelete} onClick={() => setConfirmDelete(true)}>삭제</Button>
        ) : <span />}
        <Group>
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button loading={save.isPending} disabled={!memberId || !startDate} onClick={submit}>
            {editing ? "저장" : "등록"}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
