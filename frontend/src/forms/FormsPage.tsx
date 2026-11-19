import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ActionIcon, Alert, Box, Button, Group, Menu, Modal, Paper, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { deleteForm, FORMS_KEY, listForms, moveForm, uploadForm } from "../api/forms";
import type { FormDto } from "../api/forms";
import { dropSlotAt, moveIndexOf } from "../documents/dropSlot";
import { formatDate } from "../documents/format";
import { FilePreview } from "../documents/preview/FilePreview";
import { useReorderAnimation } from "../layout/reorderAnimation";
import { useLastValue } from "../layout/useLastValue";
import { showToast } from "../toast/toastStore";
import { formatFileSize } from "./formFile";
import { FileKindIcon } from "./FileKindIcon";

// 목록 줄을 끌 때 싣는 데이터 종류 (바깥에서 끌어온 파일과 구분)
const DRAG_TYPE = "application/x-portal-form";

// 바깥에서 파일을 끌어오는 중인지 (목록 줄 끌기는 제외)
function isFileDrag(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer?.types ?? []);
  return types.includes("Files") && !types.includes(DRAG_TYPE);
}

// 팀 스페이스 "공유 보관함": 팀이 함께 쓰는 양식·자료 파일을 올리고, 미리보고, 내려받음
export function FormsPage() {
  const queryClient = useQueryClient();
  const { data: forms = [], error, isLoading } = useQuery({ queryKey: FORMS_KEY, queryFn: listForms });
  const [params, setParams] = useSearchParams();
  // 주소의 ?id= 로 고른 양식 (없거나 지워졌으면 맨 위 양식)
  const selectedId = Number(params.get("id"));
  const selected = forms.find((form) => form.id === selectedId) ?? forms[0] ?? null;
  const select = (form: FormDto) => setParams({ id: String(form.id) }, { replace: true });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  // 바깥 파일을 화면 위로 끌고 있는 동안 강조
  const [fileOver, setFileOver] = useState(false);
  const [deleting, setDeleting] = useState<FormDto | null>(null);
  // 창이 닫히는 동안에도 삭제할 이름을 그대로 보임
  const shownDeleting = useLastValue(deleting);

  const listRef = useRef<HTMLDivElement>(null);
  // 끌고 있는 양식과 가로선을 그을 줄 사이 위치 (0 = 맨 앞, forms.length = 맨 뒤)
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  useReorderAnimation(listRef, '[data-flip-id^="form-"]');

  // 고른 순서대로 하나씩 올려 목록에도 그 순서로 쌓이게 함 (실패한 파일만 알림)
  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading((count) => count + files.length);
    let last: FormDto | null = null;
    for (const file of files) {
      try {
        last = await uploadForm(file);
      } catch (e) {
        const reason = e instanceof ApiError ? e.message : "업로드하지 못했습니다.";
        showToast(`"${file.name}" 올리기 실패: ${reason}`);
      } finally {
        setUploading((count) => count - 1);
      }
    }
    await queryClient.invalidateQueries({ queryKey: FORMS_KEY });
    // 방금 올린 양식을 바로 미리보기
    if (last) select(last);
  };

  // 화면 순서를 먼저 바꾸고 서버 반영 후 다시 조회 (실패 시 서버 순서로 복구)
  const reorder = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveForm(id, index),
    onMutate: ({ id, index }) => {
      const current = queryClient.getQueryData<FormDto[]>(FORMS_KEY) ?? [];
      const moving = current.find((f) => f.id === id);
      if (!moving) return;
      const others = current.filter((f) => f.id !== id);
      others.splice(index, 0, moving);
      queryClient.setQueryData(FORMS_KEY, others);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FORMS_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteForm(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FORMS_KEY });
      setDeleting(null);
    },
  });
  const closeDelete = () => {
    setDeleting(null);
    remove.reset();
  };

  const slotOf = (e: DragEvent<HTMLElement>): number => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-form-row]") ?? []);
    return dropSlotAt(e.clientY, rows.map((row) => row.getBoundingClientRect()));
  };
  const lineOf = (index: number) => {
    if (slot === index) return "before";
    if (slot === forms.length && index === forms.length - 1) return "after";
    return undefined;
  };
  const endDrag = () => {
    setDraggingId(null);
    setSlot(null);
  };

  return (
    <Stack maw={1300} gap="sm"
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setFileOver(true);
      }}
      onDragLeave={(e: DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false);
      }}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setFileOver(false);
        void upload(Array.from(e.dataTransfer.files));
      }}
    >
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>공유 보관함</Title>
          <Text size="sm" c="dimmed">{forms.length}개</Text>
        </Group>
        <Button loading={uploading > 0} onClick={() => fileInputRef.current?.click()}>+ 파일 올리기</Button>
        <input ref={fileInputRef} type="file" multiple hidden aria-label="올릴 파일 선택"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.currentTarget.files ?? []);
            // 같은 파일을 다시 골라도 올라가도록 비움
            e.currentTarget.value = "";
            void upload(files);
          }} />
      </Group>
      {error && <Alert color="red">공유 보관함 목록을 불러오지 못했습니다.</Alert>}

      <Box className="forms-layout" data-file-over={fileOver || undefined}>
        {/* 왼쪽: 파일 목록 */}
        <Paper withBorder radius="md" p={6} className="forms-list">
          {!isLoading && forms.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">올린 파일이 없습니다.</Text>
          ) : (
            <Box
              data-testid="form-list"
              onDragOver={(e: DragEvent<HTMLDivElement>) => {
                if (draggingId === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setSlot(slotOf(e));
              }}
              onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSlot(null);
              }}
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                const id = draggingId;
                endDrag();
                if (id === null) return;
                e.preventDefault();
                e.stopPropagation();
                const index = moveIndexOf(slotOf(e), forms.findIndex((f) => f.id === id));
                if (index !== null) reorder.mutate({ id, index });
              }}
            >
              <Box ref={listRef}>
                {forms.map((form, index) => (
                  <FormRow key={form.id} form={form} selected={form.id === selected?.id} dropLine={lineOf(index)}
                    onSelect={() => select(form)} onDelete={() => setDeleting(form)}
                    onDragStart={() => setDraggingId(form.id)} onDragEnd={endDrag} />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* 오른쪽: 고른 파일 미리보기 */}
        <Paper withBorder radius="md" p="md" className="forms-preview">
          {selected ? (
            <Stack gap="md">
              {/* 다운로드는 목록 줄의 ⋯ 메뉴에서 */}
              <Box style={{ minWidth: 0 }}>
                <Title order={4} style={{ wordBreak: "break-all" }}>
                  {selected.name}
                </Title>
                <Text size="xs" c="dimmed" mt={4}>
                  {formatFileSize(selected.size)} · {formatDate(selected.createdAt)}
                </Text>
              </Box>
              <FilePreview url={selected.url} fileName={selected.name} />
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {isLoading ? "불러오는 중…" : "파일을 올리면 여기에서 미리볼 수 있습니다."}
            </Text>
          )}
        </Paper>
      </Box>

      {/* 삭제 확인 (연락처·링크 삭제 확인 창과 같은 모양) */}
      <Modal opened={deleting !== null} onClose={closeDelete} title="파일 삭제" centered>
        <Stack>
          <Text size="sm">"{shownDeleting?.name}" 파일을 삭제할까요? 팀원 모두의 목록에서 사라지며 되돌릴 수 없습니다.</Text>
          {remove.error && <Alert color="red">파일을 삭제하지 못했습니다.</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete}>취소</Button>
            <Button color="red" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)} data-autofocus>삭제</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface FormRowProps {
  form: FormDto;
  selected: boolean;
  dropLine?: "before" | "after";
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

// 양식 한 줄 (누르면 미리보기, 끌어서 순서 변경, ⋯ 메뉴로 다운로드·삭제)
function FormRow({ form, selected, dropLine, onSelect, onDelete, onDragStart, onDragEnd }: FormRowProps) {
  return (
    <Box className="form-row" data-form-row data-flip-id={`form-${form.id}`} data-selected={selected || undefined}
      data-drop-position={dropLine} draggable
      onDragStart={(e: DragEvent<HTMLDivElement>) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(DRAG_TYPE, String(form.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}>
      <UnstyledButton className="form-row-select" onClick={onSelect} aria-current={selected || undefined}
        aria-label={form.name}>
        <span className="form-row-icon"><FileKindIcon fileName={form.name} /></span>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" truncate title={form.name} fw={selected ? 600 : 400}>{form.name}</Text>
          <Text size="xs" c="dimmed" truncate>{formatFileSize(form.size)} · {formatDate(form.createdAt)}</Text>
        </Box>
      </UnstyledButton>
      <Box className="form-row-menu">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`${form.name} 메뉴`}>⋯</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item component="a" href={form.url} download={form.name}>다운로드</Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" onClick={onDelete}>파일 삭제</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>
    </Box>
  );
}
