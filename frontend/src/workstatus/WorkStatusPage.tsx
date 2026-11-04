import { useMemo, useState } from "react";
import { Alert, Badge, Box, Button, Group, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { listWorkStatuses } from "../api/workStatuses";
import type { WorkStatusDto } from "../api/workStatuses";
import { useCurrentUser } from "../user/currentUser";
import { buildMonthGrid, expandToWeekdays } from "./calendar";
import { TYPE_COLORS } from "./types";
import { WorkStatusForm } from "./WorkStatusForm";

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];
// 월~금 넓게, 토·일 좁게
const GRID_COLUMNS = "repeat(5, 1fr) 0.5fr 0.5fr";

function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WorkStatusPage() {
  const { user } = useCurrentUser();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkStatusDto | null>(null);
  const [defaultDate, setDefaultDate] = useState(todayString);

  const { data: items = [], error } = useQuery({
    queryKey: ["workStatuses", year, month],
    queryFn: () => listWorkStatuses(year, month),
  });
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const byDate = useMemo(() => expandToWeekdays(items, year, month), [items, year, month]);

  const moveMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  // 날짜 칸 클릭 또는 등록 버튼으로 신규 등록 폼 열기
  const openCreate = (date: string) => {
    setEditing(null);
    setDefaultDate(date);
    setFormOpen(true);
  };

  const openEdit = (item: WorkStatusDto) => {
    setEditing(item);
    setFormOpen(true);
  };

  return (
    <>
      <Group justify="space-between" mb="sm">
        <Button variant="default" onClick={() => moveMonth(-1)}>◀ 이전 달</Button>
        <Title order={3}>{year}년 {month}월</Title>
        <Group>
          <Button variant="default" onClick={() => moveMonth(1)}>다음 달 ▶</Button>
          <Button onClick={() => openCreate(todayString())}>+ 등록</Button>
        </Group>
      </Group>
      {error && <Alert color="red" mb="sm">근무 상황을 불러오지 못했습니다.</Alert>}
      <Box style={{ border: "1px solid var(--mantine-color-gray-4)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        <Box style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, background: "var(--mantine-color-gray-1)" }}>
          {DAY_NAMES.map((name, i) => (
            <Box
              key={name}
              ta="center"
              py={6}
              fz="sm"
              c={i === 5 ? "blue.7" : i === 6 ? "red.7" : undefined}
              style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
            >
              {name}
            </Box>
          ))}
        </Box>
        {grid.map((week) => (
          <Box key={week[0].date} style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS }}>
            {week.map((day) => (
              <Box
                key={day.date}
                p={4}
                mih={92}
                onClick={() => day.inMonth && openCreate(day.date)}
                style={{
                  borderRight: "1px solid var(--mantine-color-gray-2)",
                  borderBottom: "1px solid var(--mantine-color-gray-2)",
                  background: day.weekend ? "var(--mantine-color-gray-0)" : undefined,
                  opacity: day.inMonth ? 1 : 0.4,
                  cursor: day.inMonth ? "pointer" : "default",
                  minWidth: 0,
                }}
              >
                <Box fz="xs" c="dimmed" mb={3}>{Number(day.date.slice(8))}</Box>
                {day.inMonth && byDate.get(day.date)?.map((item) => (
                  <Badge
                    key={item.id}
                    color={TYPE_COLORS[item.type]}
                    variant="light"
                    radius="sm"
                    fullWidth
                    mb={2}
                    tt="none"
                    fw={400}
                    title={item.label}
                    // 긴 라벨(예: 외근 장소·시간)이 잘리지 않도록 Badge 기본 한 줄·고정 높이 해제
                    styles={{
                      root: {
                        cursor: "pointer",
                        display: "block",
                        textAlign: "left",
                        height: "auto",
                        lineHeight: 1.35,
                        paddingBlock: 2,
                      },
                      label: { whiteSpace: "normal", overflow: "visible", overflowWrap: "anywhere" },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(item);
                    }}
                  >
                    {item.label}
                  </Badge>
                ))}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <WorkStatusForm
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        defaultDate={defaultDate}
        currentUserId={user?.id ?? null}
      />
    </>
  );
}
