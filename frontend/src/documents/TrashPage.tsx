import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { getTrash, restoreDocument } from "../api/documents";
import type { TrashItemDto } from "../api/documents";
import { restoreSpace } from "../api/spaces";
import { formatDateTime } from "./format";

type Kind = "space" | "document";

interface TrashListProps {
  title: string;
  items: TrashItemDto[];
  pendingId: number | null;
  onRestore: (id: number) => void;
}

function TrashList({ title, items, pendingId, onRestore }: TrashListProps) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Title order={5} mb="xs">{title}</Title>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed">삭제된 항목이 없습니다.</Text>
      ) : (
        <Stack gap={6}>
          {items.map((item) => (
            <Group key={item.id} justify="space-between" wrap="nowrap">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text size="sm" truncate>{item.name}</Text>
                <Text size="xs" c="dimmed">삭제 {formatDateTime(item.deletedAt)}</Text>
              </Stack>
              <Button size="compact-sm" variant="light" loading={pendingId === item.id} onClick={() => onRestore(item.id)}>
                복원
              </Button>
            </Group>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export function TrashPage() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["trash"], queryFn: getTrash });

  // 복원 후 휴지통·사이드바·문서 목록 갱신
  const restore = useMutation({
    mutationFn: ({ kind, id }: { kind: Kind; id: number }) =>
      kind === "space" ? restoreSpace(id) : restoreDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
  const pending = restore.isPending ? restore.variables : undefined;

  return (
    <>
      <Title order={3} mb="md">휴지통</Title>
      {error && <Alert color="red" mb="sm">휴지통을 불러오지 못했습니다.</Alert>}
      {restore.error && (
        <Alert color="red" mb="sm">
          {restore.error instanceof ApiError ? restore.error.message : "복원하지 못했습니다."}
        </Alert>
      )}
      <Stack>
        <TrashList
          title="공간"
          items={data?.spaces ?? []}
          pendingId={pending?.kind === "space" ? pending.id : null}
          onRestore={(id) => restore.mutate({ kind: "space", id })}
        />
        <TrashList
          title="문서"
          items={data?.documents ?? []}
          pendingId={pending?.kind === "document" ? pending.id : null}
          onRestore={(id) => restore.mutate({ kind: "document", id })}
        />
      </Stack>
    </>
  );
}
