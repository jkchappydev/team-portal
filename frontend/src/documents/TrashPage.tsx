import { Alert, Box, Button, Group, Paper, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { getTrash, restoreDocument } from "../api/documents";
import type { TrashItemDto } from "../api/documents";
import { restoreSpace } from "../api/spaces";
import { formatDateTime } from "./format";
import { PageIcon } from "./PageIconView";

// 하위 페이지 한 단계당 들여쓰기 폭
const INDENT = 20;

// 복원 대상 (하위 페이지는 페이지 복원 API로 위치만 옮김)
interface RestoreTarget {
  kind: "space" | "document";
  id: number;
}

interface TrashRowProps {
  item: TrashItemDto;
  pending: RestoreTarget | undefined;
  onRestore: (target: RestoreTarget) => void;
}

// 삭제된 페이지 한 줄과 그 아래 함께 숨겨진 하위 페이지들
// 하위만 복원하면 가장 가까운 살아 있는 상위 페이지 아래로 옮겨짐 (그 하위도 함께)
function TrashRow({ item, pending, onRestore }: TrashRowProps) {
  const isPending = (kind: RestoreTarget["kind"], id: number) => pending?.kind === kind && pending.id === id;
  // 삭제된 프로젝트 안의 페이지는 둘 곳이 없어 프로젝트 복원이 먼저
  const childBlocked = item.kind === "space";
  return (
    <Box>
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" truncate>
            <span style={{ marginRight: 6 }}><PageIcon icon={item.icon} /></span>
            <span>{item.name}</span>
          </Text>
          <Text size="xs" c="dimmed">삭제 {formatDateTime(item.deletedAt)}</Text>
        </Stack>
        <Button
          size="compact-sm"
          variant="light"
          loading={isPending(item.kind, item.id)}
          onClick={() => onRestore({ kind: item.kind, id: item.id })}
        >
          복원
        </Button>
      </Group>
      {item.children.map((child) => (
        <Group
          key={child.id}
          justify="space-between"
          wrap="nowrap"
          py={2}
          pl={child.depth * INDENT}
          data-testid={`trash-child-${child.id}`}
          data-depth={child.depth}
        >
          <Text size="sm" c="dimmed" truncate>
            <span style={{ marginRight: 6 }}><PageIcon icon={child.icon} /></span>
            <span>{child.title}</span>
          </Text>
          <Tooltip
            label={childBlocked ? "상위 페이지를 먼저 복원하세요" : "이 페이지만 꺼내 가장 가까운 상위 페이지 아래로 복원"}
            withArrow
            openDelay={300}
          >
            {/* 비활성 버튼에도 툴팁이 뜨도록 감싸기 */}
            <span>
              <Button
                size="compact-xs"
                variant="subtle"
                aria-label={`${child.title} 복원`}
                disabled={childBlocked}
                loading={isPending("document", child.id)}
                onClick={() => onRestore({ kind: "document", id: child.id })}
              >
                복원
              </Button>
            </span>
          </Tooltip>
        </Group>
      ))}
    </Box>
  );
}

export function TrashPage() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["trash"], queryFn: getTrash });

  // 복원 후 휴지통·사이드바·문서 목록 갱신
  const restore = useMutation({
    mutationFn: (target: RestoreTarget) => (target.kind === "space" ? restoreSpace(target.id) : restoreDocument(target.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
  const pending = restore.isPending ? restore.variables : undefined;
  const items = data?.items ?? [];

  return (
    <>
      <Title order={3} mb="md">휴지통</Title>
      {error && <Alert color="red" mb="sm">휴지통을 불러오지 못했습니다.</Alert>}
      {restore.error && (
        <Alert color="red" mb="sm">
          {restore.error instanceof ApiError ? restore.error.message : "복원하지 못했습니다."}
        </Alert>
      )}
      <Paper withBorder p="sm" radius="md">
        {items.length === 0 ? (
          <Text size="sm" c="dimmed">삭제된 페이지가 없습니다.</Text>
        ) : (
          <Stack gap="sm">
            {items.map((item) => (
              <TrashRow
                key={`${item.kind}-${item.id}`}
                item={item}
                pending={pending}
                onRestore={(target) => restore.mutate(target)}
              />
            ))}
          </Stack>
        )}
      </Paper>
    </>
  );
}
