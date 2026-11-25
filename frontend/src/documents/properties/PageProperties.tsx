import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { ExternalLineIcon } from "../DefaultIcons";
import { ActionIcon, Anchor, Box, Checkbox, Menu, MultiSelect, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import { listMembers } from "../../api/members";
import {
  changePropertyValue, createProperty, deleteProperty, listProperties, moveProperty, propertiesKey, renameProperty,
} from "../../api/properties";
import type { PropertyDto, PropertyType } from "../../api/properties";
import { showToast } from "../../toast/toastStore";
import { dropIndex, PROPERTY_TYPES } from "./propertyTypes";

function TypeIcon({ type }: { type: PropertyType }) {
  const path = PROPERTY_TYPES.find((t) => t.type === type)?.icon ?? "";
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError && error.message ? error.message : "속성을 저장하지 못했습니다.";
}

// 접기 상태는 이 브라우저에만 페이지별로 기억 (저장소를 못 쓰면 매번 펼친 상태)
const collapsedKey = (documentId: number) => `page-properties-collapsed-${documentId}`;
function readCollapsed(documentId: number): boolean {
  try {
    return localStorage.getItem(collapsedKey(documentId)) === "true";
  } catch {
    return false;
  }
}
function writeCollapsed(documentId: number, collapsed: boolean) {
  try {
    localStorage.setItem(collapsedKey(documentId), String(collapsed));
  } catch {
    // 저장하지 못해도 화면 상태만 바뀜
  }
}

// 글로 입력하는 값(텍스트·숫자·URL·날짜): 입력 중에는 화면만 바꾸고 포커스를 벗어나거나 Enter면 저장
function TextValue({ property, editable, onSave }: { property: PropertyDto; editable: boolean; onSave: (value: string | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  // 빈 날짜는 다른 속성처럼 "비어 있음"으로 보이고, 누르면 날짜 입력으로 바뀜 (브라우저 기본 "연도-월-일" 대신)
  const [focused, setFocused] = useState(false);
  const value = draft ?? property.value ?? "";
  const save = () => {
    if (draft === null) return;
    const next = draft.trim() === "" ? null : draft;
    setDraft(null);
    if (next !== property.value) onSave(next);
  };
  const isLink = property.type === "URL" && /^https?:\/\//i.test(property.value ?? "");
  return (
    <Box className="page-property-value-input">
      <TextInput
        variant="unstyled"
        size="sm"
        type={property.type === "DATE" && (focused || value) ? "date" : "text"}
        inputMode={property.type === "NUMBER" ? "decimal" : undefined}
        placeholder="비어 있음"
        value={value}
        readOnly={!editable}
        aria-label={property.name}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      {isLink && (
        <Anchor href={property.value!} target="_blank" rel="noopener noreferrer" size="xs" aria-label={`${property.name} 열기`} style={{ display: "inline-flex" }}><ExternalLineIcon size={14} /></Anchor>
      )}
    </Box>
  );
}

function PersonValue({ property, editable, onSave }: { property: PropertyDto; editable: boolean; onSave: (value: string | null) => void }) {
  // 퇴사 처리된 팀원도 이름은 보이도록 전체 목록, 고를 수 있는 건 재직 중인 팀원만
  const { data: members = [] } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true) });
  const selected = (property.value ?? "").split(",").filter(Boolean);
  const data = members
    .filter((m) => m.active || selected.includes(String(m.id)))
    .map((m) => ({ value: String(m.id), label: m.name }));
  return (
    <MultiSelect
      variant="unstyled"
      size="sm"
      data={data}
      value={selected}
      placeholder={selected.length === 0 ? "비어 있음" : undefined}
      searchable
      readOnly={!editable}
      nothingFoundMessage="팀원이 없습니다"
      aria-label={property.name}
      onChange={(ids) => onSave(ids.length > 0 ? ids.join(",") : null)}
      comboboxProps={{ withinPortal: true }}
      className="page-property-people"
    />
  );
}

// 속성 이름 입력란: 열릴 때 지금 이름을 선택해 두고, 포커스를 벗어나거나 Enter면 바뀐 이름(같거나 비면 null)을 알림
function RenameInput({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <TextInput
      ref={inputRef}
      size="xs"
      maxLength={50}
      value={draft}
      aria-label="속성 이름"
      className="page-property-name-input"
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => onDone(draft.trim() && draft.trim() !== name ? draft.trim() : null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onDone(null);
      }}
    />
  );
}

// 속성 이름: 누르면 이름 바꾸기·삭제 메뉴, 이름 바꾸기는 그 자리에서 입력
function PropertyName({ property, editable, renaming, onStartRename, onRename, onDelete }: {
  property: PropertyDto;
  editable: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onRename: (name: string | null) => void;
  onDelete: () => void;
}) {
  const label = (
    <span className="page-property-name">
      <TypeIcon type={property.type} />
      <Text size="sm" c="dimmed" truncate>{property.name}</Text>
    </span>
  );
  if (renaming) return <RenameInput name={property.name} onDone={onRename} />;
  if (!editable) return label;
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton className="page-property-name-button" aria-label={`${property.name} 속성 메뉴`}>{label}</UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onStartRename}>이름 바꾸기</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" onClick={onDelete}>속성 삭제</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// 페이지 제목 아래 속성: 기본은 담당자, "+ 속성 추가"로 더하고 끌어서 순서를 바꾸며 아래 토글로 접음
export function PageProperties({ documentId, editable = true }: { documentId: number; editable?: boolean }) {
  const queryClient = useQueryClient();
  const key = propertiesKey(documentId);
  const { data: properties = [] } = useQuery({ queryKey: key, queryFn: () => listProperties(documentId) });
  const [collapsed, setCollapsed] = useState(() => readCollapsed(documentId));
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropMark, setDropMark] = useState<{ id: number; after: boolean } | null>(null);

  const replace = (updated: PropertyDto) =>
    queryClient.setQueryData<PropertyDto[]>(key, (list = []) => list.map((p) => (p.id === updated.id ? updated : p)));
  const onError = (error: unknown) => {
    showToast(errorMessage(error));
    void queryClient.invalidateQueries({ queryKey: key });
  };
  // 속성을 바꾸면 페이지 "마지막 수정"도 바뀜
  const touched = () => void queryClient.invalidateQueries({ queryKey: ["document", documentId] });

  const create = useMutation({
    mutationFn: (type: PropertyType) => createProperty(documentId, PROPERTY_TYPES.find((t) => t.type === type)!.label, type),
    onSuccess: (created) => {
      queryClient.setQueryData<PropertyDto[]>(key, (list = []) => [...list, created]);
      setRenamingId(created.id);
      touched();
    },
    onError,
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameProperty(documentId, id, name),
    onSuccess: (updated) => {
      replace(updated);
      touched();
    },
    onError,
  });
  const changeValue = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string | null }) => changePropertyValue(documentId, id, value),
    onMutate: ({ id, value }) => queryClient.setQueryData<PropertyDto[]>(key, (list = []) => list.map((p) => (p.id === id ? { ...p, value } : p))),
    onSuccess: (updated) => {
      replace(updated);
      touched();
    },
    onError,
  });
  const move = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveProperty(documentId, id, index),
    onMutate: ({ id, index }) => queryClient.setQueryData<PropertyDto[]>(key, (list = []) => {
      const moving = list.find((p) => p.id === id);
      if (!moving) return list;
      const rest = list.filter((p) => p.id !== id);
      rest.splice(index, 0, moving);
      return rest;
    }),
    onSuccess: (list) => queryClient.setQueryData(key, list),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteProperty(documentId, id),
    onMutate: (id) => queryClient.setQueryData<PropertyDto[]>(key, (list = []) => list.filter((p) => p.id !== id)),
    onSuccess: touched,
    onError,
  });

  const toggle = () => {
    setCollapsed((prev) => {
      writeCollapsed(documentId, !prev);
      return !prev;
    });
  };

  // 끌기: 손잡이로 시작, 줄 위쪽 절반이면 그 줄 앞·아래쪽 절반이면 뒤에 가로선
  const onDragStart = (event: DragEvent, id: number) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-page-property", String(id));
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>, id: number) => {
    if (dragId === null) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    if (dropMark?.id !== id || dropMark.after !== after) setDropMark({ id, after });
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    if (dragId !== null && dropMark) {
      const from = properties.findIndex((p) => p.id === dragId);
      const target = properties.findIndex((p) => p.id === dropMark.id);
      const index = dropIndex(from, target, dropMark.after);
      if (from >= 0 && target >= 0 && index !== from) move.mutate({ id: dragId, index });
    }
    setDragId(null);
    setDropMark(null);
  };
  const onDragEnd = () => {
    setDragId(null);
    setDropMark(null);
  };

  const valueEditor = (property: PropertyDto): ReactNode => {
    const save = (value: string | null) => changeValue.mutate({ id: property.id, value });
    if (property.type === "PERSON") return <PersonValue property={property} editable={editable} onSave={save} />;
    if (property.type === "CHECKBOX") {
      return (
        <Checkbox
          size="xs"
          checked={property.value === "true"}
          disabled={!editable}
          aria-label={property.name}
          onChange={(e) => save(e.currentTarget.checked ? "true" : null)}
        />
      );
    }
    return <TextValue property={property} editable={editable} onSave={save} />;
  };

  return (
    <Box className="page-properties print-hide" mb="sm">
      {!collapsed && properties.map((property) => (
        <div
          key={property.id}
          className="page-property-row"
          data-dragging={dragId === property.id || undefined}
          data-drop={dropMark?.id === property.id ? (dropMark.after ? "after" : "before") : undefined}
          onDragOver={(e) => onDragOver(e, property.id)}
          onDrop={onDrop}
        >
          {editable && (
            <span
              className="page-property-handle"
              draggable
              role="button"
              aria-label={`${property.name} 순서 바꾸기`}
              onDragStart={(e) => onDragStart(e, property.id)}
              onDragEnd={onDragEnd}
            >
              ⠿
            </span>
          )}
          <div className="page-property-label">
            <PropertyName
              property={property}
              editable={editable}
              renaming={renamingId === property.id}
              onStartRename={() => setRenamingId(property.id)}
              onRename={(name) => {
                setRenamingId(null);
                if (name) rename.mutate({ id: property.id, name });
              }}
              onDelete={() => remove.mutate(property.id)}
            />
          </div>
          <div className="page-property-value">{valueEditor(property)}</div>
          {/* 줄에 마우스를 올리면 보이는 ⋯ 메뉴 (이름을 눌러도 같은 메뉴) */}
          {editable && renamingId !== property.id && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon className="page-property-more" variant="subtle" color="gray" size="sm" aria-label={`${property.name} 속성 더보기`}>
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => setRenamingId(property.id)}>이름 바꾸기</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => remove.mutate(property.id)}>속성 삭제</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
      ))}
      {!collapsed && editable && (
        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <UnstyledButton className="page-property-add" disabled={create.isPending}>
              <Text size="sm" c="dimmed">+ 속성 추가</Text>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>속성 종류</Menu.Label>
            {PROPERTY_TYPES.map((t) => (
              <Menu.Item key={t.type} leftSection={<TypeIcon type={t.type} />} onClick={() => create.mutate(t.type)}>
                {t.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
      {properties.length > 0 && (
        <UnstyledButton className="page-property-toggle" onClick={toggle} aria-expanded={!collapsed}>
          <Text size="sm" c="dimmed" className="page-property-toggle-label">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={collapsed ? "M4 6l4 4 4-4" : "M4 10l4-4 4 4"} />
            </svg>
            {collapsed ? `속성 ${properties.length}개 보기` : `속성 ${properties.length}개 숨기기`}
          </Text>
        </UnstyledButton>
      )}
    </Box>
  );
}
