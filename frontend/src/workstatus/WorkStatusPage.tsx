import { useMemo, useState } from "react";
import { ActionIcon, Alert, Anchor, Badge, Box, Group, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { listHolidays } from "../api/holidays";
import { listWorkStatuses } from "../api/workStatuses";
import type { WorkStatusDto } from "../api/workStatuses";
import { useCurrentUser } from "../user/currentUser";
import { buildMonthGrid, expandToWeekdays } from "./calendar";
import { calculateWeekMinHeight } from "./calendarLayout";
import { groupHolidaysByDate } from "./holidayCalendar";
import { TYPE_COLORS, TYPE_LABELS, TYPE_ORDER } from "./types";
import { AnnualLeaveTable } from "./AnnualLeaveTable";
import { WorkStatusForm } from "./WorkStatusForm";
import { CURRENT_HIGHLIGHT_BACKGROUND } from "./highlight";
import { MonthPicker } from "./MonthPicker";

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];
// 월~금 넓게, 토·일 좁게
const GRID_COLUMNS = "repeat(5, 1fr) 0.5fr 0.5fr";
const CALENDAR_OUTER_BORDER = "light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-3))";
const CALENDAR_CELL_BORDER = "light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-4))";
const OUTSIDE_MONTH_BACKGROUND = "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-8))";
// 다크 모드에서 주말·요일 머리가 평일보다 밝아 보이지 않도록 아주 옅게만 구분
const WEEKEND_BACKGROUND = "light-dark(var(--mantine-color-gray-0), rgba(255, 255, 255, 0.03))";
const HEADER_BACKGROUND = "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))";
const DAY_NUMBER_COLOR = "light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-1))";

// 종류 표시색 (범례 네모·칩 막대). 회색은 다크 모드에서 배경에 묻히므로 밝은 회색 사용
function accentColor(color: string): string {
  return color === "gray"
    ? "light-dark(var(--mantine-color-gray-6), var(--mantine-color-gray-4))"
    : `var(--mantine-color-${color}-filled)`;
}

// 근무 상황 칩: 옅은 배경 + 왼쪽 색 막대 + 진한 글자 (다크 모드는 밝은 글자)
function chipColors(color: string) {
  return {
    background: `light-dark(var(--mantine-color-${color}-0), color-mix(in srgb, var(--mantine-color-${color}-9) 30%, transparent))`,
    color: `light-dark(var(--mantine-color-${color}-9), var(--mantine-color-${color}-1))`,
    borderLeft: `3px solid ${accentColor(color)}`,
  };
}

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
  const today = todayString();

  const { data: items = [], error } = useQuery({
    queryKey: ["workStatuses", year, month],
    queryFn: () => listWorkStatuses(year, month),
  });
  const { data: holidays = [], error: holidayError } = useQuery({
    queryKey: ["holidays", year, month],
    queryFn: () => listHolidays(year, month),
  });
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const byDate = useMemo(() => expandToWeekdays(items, year, month), [items, year, month]);
  const holidaysByDate = useMemo(() => groupHolidaysByDate(holidays), [holidays]);

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
      {/* 등록은 날짜 칸 클릭으로 하므로 상단에는 월 이동만 둠 */}
      {/* 가운데 월 이동, 오른쪽 위에 종류별 색 범례 */}
      <Box mb="sm" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <span />
        <Group gap="md">
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label="이전 달" onClick={() => moveMonth(-1)}>◀</ActionIcon>
          {/* 제목을 누르면 원하는 연월로 바로 이동 */}
          <MonthPicker
            year={year}
            month={month}
            onSelect={(nextYear, nextMonth) => {
              setYear(nextYear);
              setMonth(nextMonth);
            }}
          >
            {/* 한 자리·두 자리 달에 따라 좌우 화살표가 움직이지 않도록 제목 폭 고정 */}
            <Title order={3} ta="center" style={{ width: "6.5em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {year}년 {month}월
            </Title>
          </MonthPicker>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label="다음 달" onClick={() => moveMonth(1)}>▶</ActionIcon>
        </Group>
        <Group gap={10} justify="flex-end" aria-label="근무 상황 종류 범례">
          {TYPE_ORDER.map((type) => (
            <Group key={type} gap={4} wrap="nowrap">
              <Box
                w={10}
                h={10}
                style={{ borderRadius: 2, background: accentColor(TYPE_COLORS[type]) }}
              />
              <Text fz="xs" c="dimmed">{TYPE_LABELS[type]}</Text>
            </Group>
          ))}
        </Group>
      </Box>
      {error && <Alert color="red" mb="sm">근무 상황을 불러오지 못했습니다.</Alert>}
      {holidayError && <Alert color="yellow" mb="sm">공휴일 정보를 불러오지 못했습니다.</Alert>}
      <Box style={{ border: `1px solid ${CALENDAR_OUTER_BORDER}`, borderRadius: 8, overflow: "hidden", background: "var(--mantine-color-body)" }}>
        <Box style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, background: HEADER_BACKGROUND }}>
          {DAY_NAMES.map((name, i) => (
            <Box
              key={name}
              ta="center"
              py={6}
              fz="sm"
              c={i === 5 ? "blue" : i === 6 ? "red" : undefined}
              style={{ borderBottom: `1px solid ${CALENDAR_OUTER_BORDER}` }}
            >
              {name}
            </Box>
          ))}
        </Box>
        {grid.map((week) => (
          <Box
            key={week[0].date}
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gridAutoRows: "minmax(92px, max-content)",
              minHeight: calculateWeekMinHeight(
                week.map((day) => day.inMonth
                  ? (byDate.get(day.date)?.length ?? 0) + (holidaysByDate.get(day.date)?.length ?? 0)
                  : 0),
              ),
            }}
          >
            {week.map((day) => {
              const isToday = day.date === today && day.inMonth;
              return (
                <Box
                  key={day.date}
                  p={4}
                  mih={92}
                  data-today={isToday || undefined}
                  onClick={() => day.inMonth && openCreate(day.date)}
                  style={{
                    borderRight: `1px solid ${CALENDAR_CELL_BORDER}`,
                    borderBottom: `1px solid ${CALENDAR_CELL_BORDER}`,
                    background: !day.inMonth
                      ? OUTSIDE_MONTH_BACKGROUND
                      : isToday
                        ? CURRENT_HIGHLIGHT_BACKGROUND
                        : day.weekend
                          ? WEEKEND_BACKGROUND
                          : undefined,
                    cursor: day.inMonth ? "pointer" : "default",
                    minWidth: 0,
                    height: "100%",
                    overflow: "visible",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    fz="xs"
                    // 오늘 날짜는 칸 배경과 함께 숫자를 굵게 표시
                    fw={isToday ? 700 : 500}
                    mb={3}
                    style={{
                      flexShrink: 0,
                      color: holidaysByDate.has(day.date) ? "var(--mantine-color-red-text)" : DAY_NUMBER_COLOR,
                      opacity: day.inMonth ? 1 : 0.45,
                    }}
                  >
                    {Number(day.date.slice(8))}
                  </Box>
                  {day.inMonth && holidaysByDate.get(day.date)?.map((holiday) => (
                    <Text
                      key={`${holiday.date}-${holiday.name}`}
                      c="red"
                      fz="xs"
                      fw={600}
                      lh={1.2}
                      mb={1}
                      title={holiday.name}
                      style={{ flexShrink: 0, overflowWrap: "anywhere" }}
                    >
                      {holiday.name}
                    </Text>
                  ))}
                  {day.inMonth && byDate.get(day.date)?.map((item) => (
                    <Badge
                      key={item.id}
                      color={TYPE_COLORS[item.type]}
                      variant="light"
                      radius="sm"
                      fullWidth
                      mb={1}
                      tt="none"
                      fw={400}
                      fz="xs"
                      title={item.label}
                      // 긴 라벨(예: 외근 장소·시간)이 잘리지 않도록 Badge 기본 한 줄·고정 높이 해제
                      styles={{
                        root: {
                          cursor: "pointer",
                          display: "block",
                          textAlign: "left",
                          height: "auto",
                          lineHeight: 1.25,
                          paddingBlock: 2,
                          flexShrink: 0,
                          ...chipColors(TYPE_COLORS[item.type]),
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
              );
            })}
          </Box>
        ))}
      </Box>
      <Text fz="xs" c="dimmed" mt={6} ta="right">
        공휴일 정보 출처:{" "}
        <Anchor
          href="https://www.data.go.kr/data/15012690/openapi.do"
          target="_blank"
          rel="noopener noreferrer"
          inherit
        >
          공공데이터포털 한국천문연구원 특일 정보
        </Anchor>
      </Text>
      <AnnualLeaveTable year={year} />
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
