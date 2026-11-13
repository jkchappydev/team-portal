import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Box } from "@mantine/core";
import type { SpaceDto } from "../api/spaces";
import { dropSlotAt, moveIndexOf } from "../documents/dropSlot";
import { draggingSpace, SpaceNavItem } from "./SpaceNavItem";
import { useReorderAnimation } from "./reorderAnimation";

interface Props {
  spaces: SpaceDto[];
  // 끌고 있던 최상위 페이지를 끌던 줄을 뺀 목록의 index 위치로
  onMove: (id: number, index: number) => void;
}

// 사이드바 최상위 페이지 목록: 목록 영역 어디서든 가장 가까운 줄 사이에 놓아 순서 변경 (아래 빈 곳은 맨 뒤)
export function SpaceList({ spaces, onMove }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  // 가로선을 그을 줄 사이 위치 (0 = 맨 앞, spaces.length = 맨 뒤)
  const [slot, setSlot] = useState<number | null>(null);
  // 순서를 바꾸면 최상위 페이지 줄들이 새 위치로 미끄러지게
  useReorderAnimation(listRef, '[data-flip-id^="space-"]');

  const slotOf = (e: DragEvent<HTMLElement>): number => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-space-row]") ?? []);
    return dropSlotAt(e.clientY, rows.map((row) => row.getBoundingClientRect()));
  };

  const lineOf = (index: number) => {
    if (slot === index) return "before";
    if (slot === spaces.length && index === spaces.length - 1) return "after";
    return null;
  };

  return (
    <Box
      data-testid="space-list"
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        if (draggingSpace() === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setSlot(slotOf(e));
      }}
      onDragLeave={(e: DragEvent<HTMLDivElement>) => {
        // 목록 안의 다른 요소로 옮겨 갈 때는 가로선 유지
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSlot(null);
      }}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        const draggedId = draggingSpace();
        setSlot(null);
        if (draggedId === null) return;
        e.preventDefault();
        const index = moveIndexOf(slotOf(e), spaces.findIndex((s) => s.id === draggedId));
        if (index !== null) onMove(draggedId, index);
      }}
      onDragEnd={() => setSlot(null)}
    >
      <Box ref={listRef}>
        {spaces.map((space, index) => (
          <SpaceNavItem key={space.id} space={space} reorderable dropLine={lineOf(index)} />
        ))}
      </Box>
    </Box>
  );
}
