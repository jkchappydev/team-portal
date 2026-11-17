import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Box, Group, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { FAVORITES_KEY, favoritePath, listFavorites, moveFavorite } from "../api/favorites";
import type { FavoriteDto } from "../api/favorites";
import { DragHandleIcon } from "./DragHandleIcon";
import { dropSlotAt, moveIndexOf } from "./dropSlot";
import { PageIcon } from "./PageIconView";
import { useReorderAnimation } from "../layout/reorderAnimation";

const rowStyle = { display: "block", width: "100%", padding: "6px 8px", borderRadius: 6 };

const DRAG_TYPE = "application/x-portal-favorite";

// 즐겨찾기한 페이지 목록 (하위 페이지 목록과 같은 모양, 왼쪽 ⠿ 손잡이로 끌어서 순서 변경)
export function FavoritesPage() {
  const queryClient = useQueryClient();
  const { data: favorites = [], error, isLoading } = useQuery({ queryKey: FAVORITES_KEY, queryFn: listFavorites });
  // 끌고 있는 즐겨찾기와 가로선을 그을 줄 사이 위치 (0 = 맨 앞, favorites.length = 맨 뒤)
  const draggingId = useRef<number | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 순서를 바꾸면 줄들이 새 위치로 미끄러지게 (사이드바·하위 페이지 목록과 같은 효과)
  useReorderAnimation(listRef);

  // 놓자마자 화면 순서를 바꾸고, 서버가 돌려준 목록으로 맞춤 (실패하면 다시 불러옴)
  const reorder = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveFavorite(id, index),
    onMutate: ({ id, index }) => {
      queryClient.setQueryData<FavoriteDto[]>(FAVORITES_KEY, (list = []) => {
        const moving = list.find((f) => f.documentId === id);
        if (!moving) return list;
        const rest = list.filter((f) => f.documentId !== id);
        return [...rest.slice(0, index), moving, ...rest.slice(index)];
      });
    },
    onSuccess: (list) => queryClient.setQueryData(FAVORITES_KEY, list),
    onError: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  // 줄 위에 정확히 올리지 않아도 목록 영역 어디서든 가장 가까운 줄 사이를 고름
  const slotOf = (e: DragEvent<HTMLElement>): number => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>(".child-page-row") ?? []);
    return dropSlotAt(e.clientY, rows.map((row) => row.getBoundingClientRect()));
  };

  const dropAt = (slot: number) => {
    const draggedId = draggingId.current;
    draggingId.current = null;
    setDropSlot(null);
    if (draggedId === null) return;
    const index = moveIndexOf(slot, favorites.findIndex((f) => f.documentId === draggedId));
    if (index === null) return;
    reorder.mutate({ id: draggedId, index });
  };

  // 줄 사이 위치를 그 아래 줄의 위쪽 가로선(맨 뒤는 마지막 줄의 아래쪽 가로선)으로 표시
  const dropPositionOf = (rowIndex: number) => {
    if (dropSlot === rowIndex) return "before";
    if (dropSlot === favorites.length && rowIndex === favorites.length - 1) return "after";
    return undefined;
  };

  return (
    // 팀원 목록·관리 화면과 같은 배치: 큰 제목 아래 소제목 줄과 목록
    <Stack maw={960} gap="xl">
      <Title order={3}>즐겨찾기</Title>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={5}>페이지</Title>
            <Text size="sm" c="dimmed">{favorites.length}개</Text>
          </Group>
          {favorites.length > 1 && <Text size="xs" c="dimmed">드래그로 순서를 변경할 수 있습니다.</Text>}
        </Group>
        {error && <Alert color="red">즐겨찾기를 불러오지 못했습니다.</Alert>}
        {reorder.error && (
          <Alert color="red">{reorder.error instanceof ApiError ? reorder.error.message : "순서를 바꾸지 못했습니다."}</Alert>
        )}
        {!isLoading && !error && favorites.length === 0 ? (
          <Text size="sm" c="dimmed">즐겨찾기한 페이지가 없습니다. 페이지 오른쪽 위의 ☆를 누르면 여기에 추가됩니다.</Text>
        ) : (
          // 테두리 없이 줄만 두고, 왼쪽 ⠿ 손잡이로 끌어서 순서 변경 (손잡이는 줄 왼쪽 바깥, 화면 여백 안에 표시)
          <Box>
            <Box
              ref={listRef}
              onDragOver={(e: DragEvent<HTMLDivElement>) => {
                if (draggingId.current === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropSlot(slotOf(e));
              }}
              onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                // 목록 안의 다른 요소로 옮겨 갈 때는 가로선 유지
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropSlot(null);
              }}
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                if (draggingId.current === null) return;
                e.preventDefault();
                dropAt(slotOf(e));
              }}
            >
              {favorites.map((favorite, rowIndex) => (
                <Box
                  key={favorite.documentId}
                  className="page-row child-page-row"
                  data-testid={`favorite-row-${favorite.documentId}`}
                  data-drop-position={dropPositionOf(rowIndex)}
                  data-flip-id={`favorite-${favorite.documentId}`}
                >
                  <span
                    className="child-page-handle"
                    role="button"
                    aria-label={`${favorite.title} 끌어서 순서 변경`}
                    title="끌어서 순서 변경"
                    draggable
                    onDragStart={(e: DragEvent<HTMLSpanElement>) => {
                      e.dataTransfer.clearData();
                      e.dataTransfer.setData(DRAG_TYPE, String(favorite.documentId));
                      e.dataTransfer.effectAllowed = "move";
                      // 손잡이가 아닌 줄 전체가 끌리는 모양으로 표시
                      const rowEl = e.currentTarget.parentElement;
                      if (rowEl) e.dataTransfer.setDragImage?.(rowEl, 16, rowEl.offsetHeight / 2);
                      draggingId.current = favorite.documentId;
                    }}
                    onDragEnd={() => {
                      draggingId.current = null;
                      setDropSlot(null);
                    }}
                  >
                    <DragHandleIcon />
                  </span>
                  <UnstyledButton component={Link} to={favoritePath(favorite)} style={rowStyle} draggable={false}>
                    <Text size="sm"><PageIcon icon={favorite.icon} project={favorite.home} />{" "}<span>{favorite.title}</span></Text>
                  </UnstyledButton>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
