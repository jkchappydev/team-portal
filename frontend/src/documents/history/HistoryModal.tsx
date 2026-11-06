import { lazy, Suspense, useState } from "react";
import { Alert, Badge, Box, Button, Group, Loader, Modal, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHistoryVersion, listHistory } from "../../api/history";
import { showToast } from "../../toast/toastStore";
import { useCurrentUser } from "../../user/currentUser";
import { formatDateTime } from "../format";
import { restoreVersion, versionToBlocks } from "./versionContent";

// 읽기 전용 편집기 번들은 이력 창을 열 때만 로드
const VersionPreview = lazy(() => import("./VersionPreview"));

interface Props {
  opened: boolean;
  documentId: number;
  title: string;
  onClose: () => void;
}

// 페이지 화면과 사이드바 ⋯ 메뉴에서 함께 쓰는 수정 이력 창 (왼쪽 시점 목록, 오른쪽 그 시점 본문)
export function HistoryModal({ opened, documentId, title, onClose }: Props) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: entries = [], error: listError, isPending: listPending } = useQuery({
    queryKey: ["history", documentId],
    queryFn: () => listHistory(documentId),
    enabled: opened,
  });
  // 고른 시점이 없으면 가장 최근 사본을 보여줌
  const currentId = selectedId ?? entries[0]?.id ?? null;
  const selected = entries.find((e) => e.id === currentId) ?? null;

  const { data: version, error: versionError } = useQuery({
    queryKey: ["history", documentId, currentId],
    queryFn: async () => {
      const detail = await getHistoryVersion(documentId, currentId as number);
      return { ...detail, blocks: await versionToBlocks(detail.contentState) };
    },
    enabled: opened && currentId !== null,
    staleTime: Infinity,
  });

  const close = () => {
    setSelectedId(null);
    setConfirming(false);
    restore.reset();
    onClose();
  };

  const restore = useMutation({
    mutationFn: () => restoreVersion(documentId, user!.id, version!.contentState),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history", documentId] });
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      setConfirming(false);
      close();
      showToast("이 버전으로 되돌렸습니다");
    },
  });

  return (
    <Modal opened={opened} onClose={close} title={`수정 이력 · ${title}`} size="80rem" centered>
      {listError && <Alert color="red">수정 이력을 불러오지 못했습니다.</Alert>}
      {listPending && opened && <Loader size="sm" />}
      {!listPending && !listError && entries.length === 0 && (
        <Text size="sm" c="dimmed" py="md">
          저장된 이력이 없습니다. 본문이 수정되면 10분 간격으로 해당 시점 본문이 자동 저장됩니다.
        </Text>
      )}
      {entries.length > 0 && (
        <Group align="stretch" gap="md" wrap="nowrap" h="70vh">
          <Stack gap={4} w={240} style={{ flexShrink: 0 }}>
            <Text size="xs" c="dimmed">10분 간격 자동 저장 · 최근 100개</Text>
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap={2}>
                {entries.map((entry) => (
                  <UnstyledButton
                    key={entry.id}
                    className="page-row"
                    data-selected={entry.id === currentId || undefined}
                    px="xs"
                    py={6}
                    style={{ borderRadius: 6 }}
                    onClick={() => {
                      setSelectedId(entry.id);
                      setConfirming(false);
                    }}
                  >
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={entry.id === currentId ? 600 : 400}>{formatDateTime(entry.createdAt)}</Text>
                      {entry.reason === "BEFORE_RESTORE" && <Badge size="xs" variant="light" color="gray">되돌리기 전</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">{entry.createdByName ?? "수정자 기록 없음"}</Text>
                  </UnstyledButton>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
          <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" c="dimmed" truncate>
                {selected ? `${formatDateTime(selected.createdAt)} 시점 본문 (읽기 전용)` : ""}
              </Text>
              {confirming ? (
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm">지금 본문을 이 버전으로 바꿀까요?</Text>
                  <Button size="xs" variant="default" onClick={() => setConfirming(false)}>취소</Button>
                  <Button size="xs" loading={restore.isPending} onClick={() => restore.mutate()}>되돌리기</Button>
                </Group>
              ) : (
                <Button size="xs" variant="light" disabled={!version || !user} onClick={() => setConfirming(true)}>
                  이 버전으로 되돌리기
                </Button>
              )}
            </Group>
            {confirming && (
              <Text size="xs" c="dimmed">지금 본문은 "되돌리기 전" 이력으로 남아 다시 되돌릴 수 있습니다.</Text>
            )}
            {restore.error && <Alert color="red">{restore.error instanceof Error ? restore.error.message : "되돌리지 못했습니다."}</Alert>}
            {versionError && <Alert color="red">이 시점 본문을 불러오지 못했습니다.</Alert>}
            <ScrollArea style={{ flex: 1, border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
              <Box py="md" px="xs">
                {version ? (
                  <Suspense fallback={<Loader size="sm" />}>
                    <VersionPreview key={version.id} blocks={version.blocks} />
                  </Suspense>
                ) : !versionError && <Loader size="sm" m="md" />}
              </Box>
            </ScrollArea>
          </Stack>
        </Group>
      )}
    </Modal>
  );
}
