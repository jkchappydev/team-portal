import { Alert, Box, Button, Group, Modal, Paper, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client";
import { getTrash, purgeTrashItem, restoreDocument } from "../api/documents";
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
  onPurge: (item: TrashItemDto) => void;
}

// 삭제된 페이지 한 줄과 그 아래 함께 숨겨진 하위 페이지들
// 하위만 복원하면 가장 가까운 살아 있는 상위 페이지 아래로 옮겨짐 (그 하위도 함께)
function TrashRow({ item, pending, onRestore, onPurge }: TrashRowProps) {
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
        <Group gap={6} wrap="nowrap">
          <Button
            size="compact-sm"
            variant="light"
            loading={isPending(item.kind, item.id)}
            onClick={() => onRestore({ kind: item.kind, id: item.id })}
          >
            복원
          </Button>
          <Button
            size="compact-sm"
            variant="subtle"
            color="red"
            aria-label={`${item.name} 영구 삭제`}
            onClick={() => onPurge(item)}
          >
            영구 삭제
          </Button>
        </Group>
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

interface PurgeModalProps {
  item: TrashItemDto | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// 영구 삭제 확인 창 (하위 페이지와 첨부 파일까지 지워져 되돌릴 수 없음을 안내)
function PurgeModal({ item, pending, error, onClose, onConfirm }: PurgeModalProps) {
  return (
    <Modal opened={item !== null} onClose={onClose} title="영구 삭제" centered>
      <Stack>
        <Text size="sm">
          {`"${item?.name ?? ""}" 페이지를 영구 삭제할까요? 하위 페이지, 수정 이력, 첨부 파일과 이미지까지 모두 지워지며 되돌릴 수 없습니다.`}
        </Text>
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
  const [purgeTarget, setPurgeTarget] = useState<TrashItemDto | null>(null);

  // 휴지통·사이드바·문서 목록·검색 결과 갱신
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trash"] });
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  };

  const restore = useMutation({
    mutationFn: (target: RestoreTarget) => (target.kind === "space" ? restoreSpace(target.id) : restoreDocument(target.id)),
    onSuccess: refresh,
  });
  const purge = useMutation({
    mutationFn: (item: TrashItemDto) => purgeTrashItem(item.kind, item.id),
    onSuccess: () => {
      setPurgeTarget(null);
      refresh();
    },
  });
  const pending = restore.isPending ? restore.variables : undefined;
  const items = data?.items ?? [];

  const openPurge = (item: TrashItemDto) => {
    purge.reset();
    setPurgeTarget(item);
  };

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
                onPurge={openPurge}
              />
            ))}
          </Stack>
        )}
      </Paper>
      <PurgeModal
        item={purgeTarget}
        pending={purge.isPending}
        error={purge.error ? (purge.error instanceof ApiError ? purge.error.message : "영구 삭제하지 못했습니다.") : null}
        onClose={() => setPurgeTarget(null)}
        onConfirm={() => purgeTarget && purge.mutate(purgeTarget)}
      />
    </>
  );
}
