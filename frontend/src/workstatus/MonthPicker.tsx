import { useState } from "react";
import type { ReactNode } from "react";
import { ActionIcon, Box, Button, Group, Popover, Text, UnstyledButton } from "@mantine/core";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
  // 선택 창을 여는 대상 (보통 "2026년 11월" 제목)
  children: ReactNode;
}

// 제목을 누르면 연도 이동과 1~12월 선택으로 원하는 달로 바로 이동하는 작은 선택 창
export function MonthPicker({ year, month, onSelect, children }: Props) {
  const [opened, setOpened] = useState(false);
  // 선택 창 안에서 넘겨 보는 연도 (열 때마다 현재 보고 있는 연도로 초기화)
  const [viewYear, setViewYear] = useState(year);
  // "이번 달" 기준 시각 (렌더마다 바뀌지 않도록 처음 한 번만 계산)
  const [now] = useState(() => new Date());

  const open = () => {
    setViewYear(year);
    setOpened((v) => !v);
  };

  const select = (nextYear: number, nextMonth: number) => {
    onSelect(nextYear, nextMonth);
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" width={240} shadow="md" withinPortal>
      <Popover.Target>
        <UnstyledButton onClick={open} aria-label="연월 선택" aria-haspopup="dialog" className="page-row" px={6} style={{ borderRadius: 6 }}>
          {children}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Group justify="space-between" mb="xs">
          <ActionIcon variant="subtle" color="gray" aria-label="이전 해" onClick={() => setViewYear((y) => y - 1)}>◀</ActionIcon>
          <Text fw={700}>{viewYear}년</Text>
          <ActionIcon variant="subtle" color="gray" aria-label="다음 해" onClick={() => setViewYear((y) => y + 1)}>▶</ActionIcon>
        </Group>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {MONTHS.map((m) => {
            const selected = viewYear === year && m === month;
            const current = viewYear === now.getFullYear() && m === now.getMonth() + 1;
            return (
              <Button
                key={m}
                size="xs"
                px={0}
                variant={selected ? "filled" : current ? "light" : "subtle"}
                color={selected || current ? undefined : "gray"}
                aria-pressed={selected}
                onClick={() => select(viewYear, m)}
              >
                {m}월
              </Button>
            );
          })}
        </Box>
        <Button fullWidth size="xs" variant="default" mt="xs" onClick={() => select(now.getFullYear(), now.getMonth() + 1)}>
          이번 달
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}
