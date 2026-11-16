import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Alert, Group, HoverCard, NumberInput, Text, Title, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAnnualLeaves, updateAnnualLeave } from "../api/annualLeaves";
import type { AnnualLeaveSummaryDto, LeaveUsageDayDto } from "../api/annualLeaves";
import { leaveWeekRangeLabel } from "./calendar";
import { CURRENT_HIGHLIGHT_BACKGROUND, currentMonthOf, currentWeekOf } from "./highlight";
import { useCurrentUser } from "../user/currentUser";
import { useMemberReorder } from "../members/useMemberReorder";
import { useReorderAnimation } from "../layout/reorderAnimation";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WEEKS = [1, 2, 3, 4, 5];

const BORDER = "1px solid var(--mantine-color-default-border)";
// 월 구분을 위해 짝수 달 열에 옅은 배경
const EVEN_MONTH_BG = "var(--mantine-color-default-hover)";

// 가로 스크롤 없이 화면 폭에 맞추도록 고정 레이아웃 + 작은 글자
const cell: CSSProperties = {
  border: BORDER,
  padding: "3px 0",
  fontSize: 11,
  textAlign: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const headCell: CSSProperties = { ...cell, fontWeight: 600, background: "var(--mantine-color-default-hover)" };

const compactInput = {
  input: { height: 22, minHeight: 22, padding: "0 2px", fontSize: 11, textAlign: "center" as const },
};

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

const MEMO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 칸 메모 한 줄 (예: 9/28 (월) 연차)
function memoLine({ date, label }: LeaveUsageDayDto): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = MEMO_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} (${weekday}) ${label}`;
}

// 사용 일수 칸. 마우스를 올리면 구글 시트 메모처럼 그 주에 연차를 쓴 날짜를 칸 오른쪽에 보여줌
function UsageCell({ testId, days, dates, style }: {
  testId: string;
  days: number | undefined;
  dates: LeaveUsageDayDto[];
  style: CSSProperties;
}) {
  const td = <td data-testid={testId} style={style}>{days !== undefined ? formatDays(days) : ""}</td>;
  if (days === undefined || dates.length === 0) return td;
  return (
    <HoverCard position="right-start" offset={2} openDelay={100} closeDelay={50} shadow="md" radius={0}>
      <HoverCard.Target>{td}</HoverCard.Target>
      <HoverCard.Dropdown p="6px 10px" style={{ minWidth: 140 }}>
        {dates.map((day) => (
          <Text key={`${day.date}-${day.label}`} fz="sm" lh={1.5} style={{ whiteSpace: "nowrap" }}>{memoLine(day)}</Text>
        ))}
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

// 이번 달 열은 머리글부터 사용 칸까지 같은 노란 배경, 그 외 짝수 달은 옅은 회색
function monthBg(month: number, currentMonth: number | null): string | undefined {
  if (month === currentMonth) return CURRENT_HIGHLIGHT_BACKGROUND;
  return month % 2 === 0 ? EVEN_MONTH_BG : undefined;
}

type CurrentWeek = ReturnType<typeof currentWeekOf>;
// 이번 주 열 테두리 (같은 너비면 왼쪽 칸 테두리가 이겨 빨간 선이 묻히므로 기본선보다 두껍게)
const CURRENT_WEEK_BORDER = "2px solid var(--mantine-color-red-filled)";

// 이번 주 열은 주 번호 머리글부터 마지막 팀원 줄까지 빨간 사각형으로 둘러쌈
function weekFrame(month: number, week: number, currentWeek: CurrentWeek, edge: { top?: boolean; bottom?: boolean }): CSSProperties {
  if (currentWeek?.month !== month || currentWeek.week !== week) return {};
  return {
    borderLeft: CURRENT_WEEK_BORDER,
    borderRight: CURRENT_WEEK_BORDER,
    ...(edge.top ? { borderTop: CURRENT_WEEK_BORDER } : {}),
    ...(edge.bottom ? { borderBottom: CURRENT_WEEK_BORDER } : {}),
  };
}

interface AnnualLeaveRowProps {
  item: AnnualLeaveSummaryDto;
  year: number;
  currentMonth: number | null;
  currentWeek: CurrentWeek;
  last: boolean;
  admin: boolean;
  reorder: ReturnType<typeof useMemberReorder>;
}

function AnnualLeaveRow({ item, year, currentMonth, currentWeek, last, admin, reorder }: AnnualLeaveRowProps) {
  const queryClient = useQueryClient();
  const [confirmedDays, setConfirmedDays] = useState<number | string>(item.confirmedDays);
  const [carriedDays, setCarriedDays] = useState<number | string>(item.carriedDays);
  const update = useMutation({
    mutationFn: () => updateAnnualLeave(item.memberId, year, {
      confirmedDays: Number(confirmedDays),
      carriedDays: Number(carriedDays),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["annualLeaves", year] }),
  });
  const changed = Number(confirmedDays) !== item.confirmedDays || Number(carriedDays) !== item.carriedDays;
  const invalid = confirmedDays === "" || carriedDays === ""
    || Number(confirmedDays) < 0 || Number(carriedDays) < 0;

  // 저장 버튼 없이 입력을 마치면(포커스 이동·Enter) 바로 저장
  const saveIfChanged = () => {
    if (changed && !invalid && !update.isPending) {
      update.mutate();
    }
  };

  // 퇴사·비활성 팀원 줄은 값만 보여줌
  const balanceInput = (label: string, value: number | string, onChange: (v: number | string) => void) => !item.editable ? (
    <span aria-label={`${item.memberName} ${label}`}>{formatDays(Number(value))}</span>
  ) : (
    <NumberInput
      aria-label={`${item.memberName} ${label}`}
      value={value}
      onChange={onChange}
      onBlur={saveIfChanged}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      min={0}
      step={0.25}
      decimalScale={2}
      hideControls
      size="xs"
      variant="unstyled"
      className="balance-input"
      title={`${label} 입력 (Enter 또는 다른 곳 클릭 시 저장)`}
      error={update.isError || undefined}
      styles={compactInput}
    />
  );

  // 월-주 → 사용 일수와 날짜
  const usage = new Map(item.weeklyUsages.map((u) => [`${u.month}-${u.week}`, u]));

  return (
    <tr data-flip-id={`member-${item.memberId}`} data-member-drop={reorder.target?.id === item.memberId ? (reorder.target.after ? "after" : "before") : undefined}
      onDragOver={(event) => reorder.over(event, item.memberId)} onDrop={(event) => reorder.drop(event, item.memberId)}>
      <td style={{ ...cell, position: "relative", overflow: "visible", textAlign: "left", paddingLeft: 6, fontWeight: 600,
        color: item.editable ? undefined : "var(--mantine-color-dimmed)" }} title={item.memberName}>
        {admin && <button type="button" className="member-drag-handle" draggable
          aria-label={`${item.memberName} 순서 변경`} onDragStart={(event) => reorder.start(event, item.memberId)} onDragEnd={reorder.end}>⠿</button>}
        {item.memberName}
      </td>
      {MONTHS.flatMap((month) => WEEKS.map((week) => {
        const weekUsage = usage.get(`${month}-${week}`);
        return (
          <UsageCell
            key={`${month}-${week}`}
            testId={`usage-${item.memberId}-${month}-${week}`}
            days={weekUsage?.days}
            dates={weekUsage?.dates ?? []}
            style={{ ...cell, background: monthBg(month, currentMonth), ...weekFrame(month, week, currentWeek, { bottom: last }) }}
          />
        );
      }))}
      <td style={{ ...cell, fontWeight: 600 }}>{formatDays(item.usedDays)}</td>
      <td style={cell}>{balanceInput("이월 연차", carriedDays, setCarriedDays)}</td>
      <td style={cell}>{balanceInput("확정 연차", confirmedDays, setConfirmedDays)}</td>
      <td style={{ ...cell, fontWeight: 700, color: item.remainingDays < 0 ? "var(--mantine-color-red-filled)" : undefined }}>
        {formatDays(item.remainingDays)}
      </td>
    </tr>
  );
}

export function AnnualLeaveTable({ year }: { year: number }) {
  const currentMonth = currentMonthOf(year);
  const currentWeek = currentWeekOf(year);
  const { data = [], error } = useQuery({
    queryKey: ["annualLeaves", year],
    queryFn: () => listAnnualLeaves(year),
  });
  const { user } = useCurrentUser();
  const reorder = useMemberReorder(data.map((item) => item.memberId), !!user?.admin);
  // 순서를 바꾸면 팀원 줄들이 새 위치로 미끄러지게 (팀원 관리 화면과 같은 효과)
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useReorderAnimation(bodyRef);

  return (
    <section>
      <Group justify="space-between" mt="xl" mb="xs">
        <Title order={4}>{year}년 연차 사용 현황</Title>
        <Text c="dimmed" fz="xs">연차 1일 · 반차 0.5일 · 반반차 0.25일 · 공가는 0으로 표시하고 합계에서 제외 · 주는 월요일 시작 달력 기준</Text>
      </Group>
      {error && <Alert color="red" mb="sm">연차 정보를 불러오지 못했습니다.</Alert>}
      {reorder.error && <Alert color="red" mb="sm">팀원 순서를 저장하지 못했습니다.</Alert>}
      {/* 아주 좁은 화면에서만 가로 스크롤 허용 */}
      <div className="annual-leave-scroll">
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 64 }} />
            {MONTHS.flatMap((month) => WEEKS.map((week) => <col key={`${month}-${week}`} />))}
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={headCell}>이름</th>
              {MONTHS.map((month) => (
                <th
                  key={month}
                  colSpan={WEEKS.length}
                  data-current-month={month === currentMonth || undefined}
                  style={month === currentMonth ? { ...headCell, background: CURRENT_HIGHLIGHT_BACKGROUND } : headCell}
                >
                  {month}월
                </th>
              ))}
              <th rowSpan={2} style={headCell}>합계</th>
              <th rowSpan={2} style={headCell} title="이월 연차">이월</th>
              <th rowSpan={2} style={headCell} title={`${year}년 확정 연차`}>확정</th>
              <th rowSpan={2} style={headCell} title="잔여 연차">잔여</th>
            </tr>
            <tr>
              {/* 주 번호에 마우스를 올리면 해당 주의 평일(월~금) 날짜 범위 표시 */}
              {MONTHS.flatMap((month) => WEEKS.map((week) => {
                const range = leaveWeekRangeLabel(year, month, week);
                return (
                  <Tooltip key={`${month}-${week}`} label={range} disabled={!range} fz="xs" withArrow openDelay={100}>
                    <th
                      data-testid={`week-head-${month}-${week}`}
                      data-current-week={(currentWeek?.month === month && currentWeek.week === week) || undefined}
                      style={{ ...cell, fontSize: 10, fontWeight: 400, color: "var(--mantine-color-dimmed)", background: monthBg(month, currentMonth),
                        ...weekFrame(month, week, currentWeek, { top: true, bottom: data.length === 0 }) }}
                    >
                      {week}
                    </th>
                  </Tooltip>
                );
              }))}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {data.map((item, index) => (
              <AnnualLeaveRow
                key={`${year}-${item.memberId}-${item.confirmedDays}-${item.carriedDays}`}
                item={item}
                year={year}
                currentMonth={currentMonth}
                currentWeek={currentWeek}
                last={index === data.length - 1}
                admin={!!user?.admin}
                reorder={reorder}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
