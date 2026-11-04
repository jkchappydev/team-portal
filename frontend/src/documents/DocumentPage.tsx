import { lazy, Suspense, useState } from "react";
import { Alert, Anchor, Box, Button, Group, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { deleteDocument, getDocument, renameDocument } from "../api/documents";
import { useCurrentUser } from "../user/currentUser";
import { AttachmentPanel } from "./AttachmentPanel";
import { formatDateTime } from "./format";

// 편집기 번들은 문서 화면에서만 로드
const CollaborativeEditor = lazy(() => import("./CollaborativeEditor"));

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function DocumentPage() {
  const documentId = Number(useParams().documentId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  // 편집 중인 제목 (null이면 서버 제목 표시)
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: doc, error, isPending } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: Number.isInteger(documentId),
  });

  const rename = useMutation({
    mutationFn: (next: string) => renameDocument(documentId, next),
    onSuccess: (detail) => {
      queryClient.setQueryData(["document", documentId], detail);
      queryClient.invalidateQueries({ queryKey: ["documents", detail.spaceId] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteDocument(documentId),
    onSuccess: () => {
      const spaceId = doc?.spaceId;
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.removeQueries({ queryKey: ["document", documentId] });
      setConfirmDelete(false);
      navigate(spaceId ? `/spaces/${spaceId}` : "/work-status");
    },
  });

  // 비어 있거나 바뀌지 않은 제목은 저장하지 않음
  const saveTitle = () => {
    if (!doc || titleDraft === null) return;
    const next = titleDraft.trim();
    if (next && next !== doc.title) {
      rename.mutate(next, { onSettled: () => setTitleDraft(null) });
    } else {
      setTitleDraft(null);
    }
  };

  if (!Number.isInteger(documentId) || (error instanceof ApiError && error.status === 404)) {
    return <Alert color="gray">삭제되었거나 없는 문서입니다</Alert>;
  }
  if (error) {
    return <Alert color="red">{errorMessage(error, "문서를 불러오지 못했습니다.")}</Alert>;
  }
  if (isPending || !doc || !user) {
    return <Loader size="sm" />;
  }

  return (
    <>
      <Group justify="space-between" mb={4}>
        <Anchor component={Link} to={`/spaces/${doc.spaceId}`} size="sm">
          ← {doc.spaceName ?? "공간"}
        </Anchor>
        <Button variant="default" color="red" size="xs" onClick={() => setConfirmDelete(true)}>
          문서 삭제
        </Button>
      </Group>
      <TextInput
        variant="unstyled"
        size="xl"
        fw={700}
        maxLength={200}
        value={titleDraft ?? doc.title}
        placeholder="제목"
        onChange={(e) => setTitleDraft(e.currentTarget.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label="문서 제목"
      />
      <Text size="xs" c="dimmed" mb="sm">
        마지막 수정 {doc.updatedByName ?? "-"} · {formatDateTime(doc.updatedAt)}
      </Text>
      {rename.error && <Alert color="red" mb="sm">{errorMessage(rename.error, "제목을 저장하지 못했습니다.")}</Alert>}
      <Box style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box style={{ flex: "1 1 560px", minWidth: 0 }}>
          <Suspense fallback={<Loader size="sm" />}>
            <CollaborativeEditor key={`${doc.id}-${user.id}`} documentId={doc.id} user={user} />
          </Suspense>
        </Box>
        <Box style={{ flex: "0 1 300px", minWidth: 260 }}>
          <AttachmentPanel documentId={doc.id} />
        </Box>
      </Box>

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="문서 삭제" centered>
        <Stack>
          <Text size="sm">"{doc.title}" 문서를 삭제할까요? 휴지통에서 복원할 수 있습니다.</Text>
          {remove.error && <Alert color="red">{errorMessage(remove.error, "문서를 삭제하지 못했습니다.")}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(false)}>취소</Button>
            <Button color="red" loading={remove.isPending} onClick={() => remove.mutate()}>삭제</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
