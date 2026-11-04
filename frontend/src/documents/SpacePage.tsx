import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { createDocument, listDocuments } from "../api/documents";
import { deleteSpace, listSpaces, updateSpace } from "../api/spaces";
import { formatDateTime } from "./format";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function SpacePage() {
  const spaceId = Number(useParams().spaceId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: spaces, isPending: spacesPending, error: spacesError } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });
  const space = spaces?.find((s) => s.id === spaceId);
  const {
    data: documents = [],
    error: documentsError,
    isPending: documentsPending,
  } = useQuery({
    queryKey: ["documents", spaceId],
    queryFn: () => listDocuments(spaceId),
    enabled: Number.isInteger(spaceId),
  });

  const create = useMutation({
    mutationFn: () => createDocument(spaceId),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["documents", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      navigate(`/documents/${doc.id}`);
    },
  });

  const update = useMutation({
    mutationFn: () => updateSpace(spaceId, name.trim(), description.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      setEditing(false);
    },
  });

  // 공간 삭제 후 근무 상황표로 이동, 사이드바·휴지통 목록 갱신
  const remove = useMutation({
    mutationFn: () => deleteSpace(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setConfirmDelete(false);
      navigate("/work-status");
    },
  });

  if (spacesError) {
    return <Alert color="red">공간 정보를 불러오지 못했습니다.</Alert>;
  }
  if (!spacesPending && !space) {
    return <Alert color="gray">삭제되었거나 없는 공간입니다.</Alert>;
  }

  const openEdit = () => {
    setName(space?.name ?? "");
    setDescription(space?.description ?? "");
    update.reset();
    setEditing(true);
  };

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={2}>
          <Title order={3}>{space?.name ?? ""}</Title>
          {space?.description && <Text c="dimmed" size="sm">{space.description}</Text>}
        </Stack>
        <Group>
          <Button variant="default" onClick={openEdit} disabled={!space}>공간 수정</Button>
          <Button variant="default" color="red" onClick={() => setConfirmDelete(true)} disabled={!space}>
            공간 삭제
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending}>+ 새 문서</Button>
        </Group>
      </Group>
      {create.error && <Alert color="red" mb="sm">{errorMessage(create.error, "문서를 만들지 못했습니다.")}</Alert>}
      {documentsError && <Alert color="red" mb="sm">문서 목록을 불러오지 못했습니다.</Alert>}
      {!documentsPending && documents.length === 0 ? (
        <Text c="dimmed">문서가 없습니다. "+ 새 문서"로 첫 문서를 만들어 보세요.</Text>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>제목</Table.Th>
              <Table.Th w={160}>마지막 수정자</Table.Th>
              <Table.Th w={180}>수정 시각</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {documents.map((doc) => (
              <Table.Tr key={doc.id}>
                <Table.Td>
                  <Link to={`/documents/${doc.id}`}>{doc.title}</Link>
                </Table.Td>
                <Table.Td>{doc.updatedByName ?? "-"}</Table.Td>
                <Table.Td>{formatDateTime(doc.updatedAt)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={editing} onClose={() => setEditing(false)} title="공간 수정" centered>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) update.mutate();
          }}
        >
          <Stack>
            <TextInput
              label="공간 이름"
              maxLength={100}
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              data-autofocus
            />
            <Textarea
              label="설명"
              maxLength={500}
              autosize
              minRows={2}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
            {update.error && <Alert color="red">{errorMessage(update.error, "공간을 수정하지 못했습니다.")}</Alert>}
            <Button type="submit" loading={update.isPending}>저장</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="공간 삭제" centered>
        <Stack>
          <Text size="sm">"{space?.name}" 공간을 삭제할까요? 휴지통에서 복원할 수 있습니다.</Text>
          {remove.error && <Alert color="red">{errorMessage(remove.error, "공간을 삭제하지 못했습니다.")}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(false)}>취소</Button>
            <Button color="red" loading={remove.isPending} onClick={() => remove.mutate()}>삭제</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
