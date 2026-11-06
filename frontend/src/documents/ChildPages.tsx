import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Box, Text, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { createDocument, listDocuments, moveDocument } from "../api/documents";
import { dropSlotAt, moveIndexOf } from "./dropSlot";
import { PageIcon } from "./PageIconView";
import { childrenOf, groupByParent } from "./pageTree";

const rowStyle = { display: "block", width: "100%", padding: "6px 8px", borderRadius: 6 };

const DRAG_TYPE = "application/x-portal-child-page";

// 편집기 블록 손잡이와 같은 모양의 6점 끌기 아이콘
function DragHandleIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden fill="currentColor">
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7.5" cy="7" r="1.2" />
      <circle cx="2.5" cy="11.5" r="1.2" />
      <circle cx="7.5" cy="11.5" r="1.2" />
    </svg>
  );
}

interface Props {
  spaceId: number;
  // 이 페이지의 하위 페이지를 보여줌 (null이면 최상위 페이지 바로 아래)
  parentId: number | null;
}

// 본문 아래 하위 페이지 목록과 "+ 페이지 추가" 줄 (끌어서 순서 변경)
export function ChildPages({ spaceId, parentId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pages = [], error } = useQuery({
    queryKey: ["documents", spaceId],
    queryFn: () => listDocuments(spaceId),
  });
  const children = childrenOf(groupByParent(pages), parentId);
  // 끌고 있는 하위 페이지와 가로선을 그을 줄 사이 위치 (0 = 맨 앞, children.length = 맨 뒤)
  const draggingId = useRef<number | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const create = useMutation({
    mutationFn: () => createDocument(spaceId, parentId),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["documents", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      navigate(`/documents/${doc.id}`);
    },
  });

  // 같은 상위 안에서 순서만 바꾸고 사이드바 트리도 함께 갱신
  const reorder = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveDocument(id, parentId, index),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents", spaceId] }),
  });

  // 줄 위에 정확히 올리지 않아도 목록 영역 어디서든 가장 가까운 줄 사이를 고름 (맨 위·맨 아래 바깥 포함)
  const slotOf = (e: DragEvent<HTMLElement>): number => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>(".child-page-row") ?? []);
    return dropSlotAt(e.clientY, rows.map((row) => row.getBoundingClientRect()));
  };

  const dropAt = (slot: number) => {
    const draggedId = draggingId.current;
    draggingId.current = null;
    setDropSlot(null);
    if (draggedId === null) return;
    const index = moveIndexOf(slot, children.findIndex((p) => p.id === draggedId));
    if (index === null) return;
    reorder.mutate({ id: draggedId, index });
  };

  // 줄 사이 위치를 그 아래 줄의 위쪽 가로선(맨 뒤는 마지막 줄의 아래쪽 가로선)으로 표시
  const dropPositionOf = (rowIndex: number) => {
    if (dropSlot === rowIndex) return "before";
    if (dropSlot === children.length && rowIndex === children.length - 1) return "after";
    return undefined;
  };

  return (
    <Box
      ref={listRef}
      mt="xl"
      pt="sm"
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
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
      <Text size="xs" c="dimmed" fw={600} mb={4}>하위 페이지</Text>
      {error && <Alert color="red" mb="sm">하위 페이지를 불러오지 못했습니다.</Alert>}
      {(create.error || reorder.error) && (
        <Alert color="red" mb="sm">
          {(create.error ?? reorder.error) instanceof ApiError
            ? (create.error ?? reorder.error)!.message
            : create.error ? "페이지를 만들지 못했습니다." : "순서를 바꾸지 못했습니다."}
        </Alert>
      )}
      {/* 페이지는 화면 이동, 파일 항목은 미리보기. 순서는 왼쪽 ⠿ 손잡이로만 끌어서 변경 */}
      {children.map((page, rowIndex) => (
        <Box
          key={page.id}
          className="page-row child-page-row"
          data-testid={`child-row-${page.id}`}
          data-drop-position={dropPositionOf(rowIndex)}
        >
          <span
            className="child-page-handle"
            role="button"
            aria-label={`${page.title} 끌어서 순서 변경`}
            title="끌어서 순서 변경"
            draggable
            onDragStart={(e: DragEvent<HTMLSpanElement>) => {
              e.dataTransfer.clearData();
              e.dataTransfer.setData(DRAG_TYPE, String(page.id));
              e.dataTransfer.effectAllowed = "move";
              // 손잡이가 아닌 줄 전체가 끌리는 모양으로 표시
              const rowEl = e.currentTarget.parentElement;
              if (rowEl) e.dataTransfer.setDragImage?.(rowEl, 16, rowEl.offsetHeight / 2);
              draggingId.current = page.id;
            }}
            onDragEnd={() => {
              draggingId.current = null;
              setDropSlot(null);
            }}
          >
            <DragHandleIcon />
          </span>
          <UnstyledButton
            component={Link}
            to={page.kind === "FILE" ? `/files/${page.id}` : `/documents/${page.id}`}
            style={rowStyle}
            draggable={false}
          >
            <Text size="sm"><PageIcon icon={page.icon} />{" "}<span>{page.title}</span></Text>
          </UnstyledButton>
        </Box>
      ))}
      <UnstyledButton onClick={() => create.mutate()} disabled={create.isPending} style={rowStyle} className="page-row">
        <Text size="sm" c="dimmed">+ 페이지 추가</Text>
      </UnstyledButton>
    </Box>
  );
}
