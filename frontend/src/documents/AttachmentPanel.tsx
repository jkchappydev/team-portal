import { useRef, useState } from "react";
import { Alert, Anchor, Button, Group, Modal, Paper, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteAttachment, listAttachments, uploadAttachment } from "../api/attachments";
import type { AttachmentDto } from "../api/attachments";
import { ApiError } from "../api/client";
import { formatDateTime, formatFileSize } from "./format";

interface Props {
  documentId: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function AttachmentPanel({ documentId }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<AttachmentDto | null>(null);
  const queryKey = ["attachments", documentId];

  const { data: attachments = [], error: loadError } = useQuery({
    queryKey,
    queryFn: () => listAttachments(documentId),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(documentId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteAttachment(id),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <Paper withBorder p="sm" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={5}>첨부 파일</Title>
        <Button size="compact-sm" variant="light" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
          업로드
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) upload.mutate(file);
            e.currentTarget.value = "";
          }}
        />
      </Group>
      {upload.error && <Alert color="red" mb="xs">{errorMessage(upload.error, "업로드하지 못했습니다.")}</Alert>}
      {loadError && <Alert color="red" mb="xs">첨부 목록을 불러오지 못했습니다.</Alert>}
      {attachments.length === 0 ? (
        <Text size="sm" c="dimmed">첨부 파일이 없습니다.</Text>
      ) : (
        <Stack gap={6}>
          {attachments.map((a) => (
            <Group key={a.id} justify="space-between" wrap="nowrap" gap="xs">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Anchor href={a.url} download={a.originalName} size="sm" truncate>
                  {a.originalName}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {formatFileSize(a.size)} · {a.uploadedByName ?? "-"} · {formatDateTime(a.createdAt)}
                </Text>
              </Stack>
              <Button size="compact-xs" color="red" variant="subtle" onClick={() => setDeleting(a)}>
                삭제
              </Button>
            </Group>
          ))}
        </Stack>
      )}
      <Modal opened={deleting !== null} onClose={() => setDeleting(null)} title="첨부 삭제" centered>
        <Stack>
          <Text size="sm">"{deleting?.originalName}" 파일을 삭제할까요?</Text>
          {remove.error && <Alert color="red">{errorMessage(remove.error, "삭제하지 못했습니다.")}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleting(null)}>취소</Button>
            <Button color="red" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
              삭제
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
