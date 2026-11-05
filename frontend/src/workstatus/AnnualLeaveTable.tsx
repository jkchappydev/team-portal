import { useState } from "react";
import type { CSSProperties } from "react";
import { Alert, Group, NumberInput, Text, Title, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAnnualLeaves, updateAnnualLeave } from "../api/annualLeaves";
import type { AnnualLeaveSummaryDto } from "../api/annualLeaves";
import { leaveWeekRangeLabel } from "./calendar";
import { CURRENT_HIGHLIGHT_BACKGROUND, currentMonthOf } from "./highlight";

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

// 이번 달 열은 머리글부터 사용 칸까지 같은 노란 배경, 그 외 짝수 달은 옅은 회색
function monthBg(month: number, currentMonth: number | null): string | undefined {
  if (month === currentMonth) return CURRENT_HIGHLIGHT_BACKGROUND;
  return month % 2 === 0 ? EVEN_MONTH_BG : undefined;
}

interface AnnualLeaveRowProps {
  item: AnnualLeaveSummaryDto;
  year: number;
  currentMonth: number | null;
}

function AnnualLeaveRow({ item, year, currentMonth }: AnnualLeaveRowProps) {
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

  const balanceInput = (label: string, value: number | string, onChange: (v: number | string) => void) => (
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

  // 월-주 → 사용 일수
  const usage = new Map(item.weeklyUsages.map((u) => [`${u.month}-${u.week}`, u.days]));

  return (
    <tr>
      <td style={{ ...cell, textAlign: "left", paddingLeft: 6, fontWeight: 600 }} title={item.memberName}>
        {item.memberName}
      </td>
      {MONTHS.flatMap((month) => WEEKS.map((week) => {
        const days = usage.get(`${month}-${week}`);
        return (
          <td
            key={`${month}-${week}`}
            data-testid={`usage-${item.memberId}-${month}-${week}`}
            title={days !== undefined ? `${month}월 ${week}주 ${formatDays(days)}일` : undefined}
            style={{ ...cell, background: monthBg(month, currentMonth) }}
          >
            {days !== undefined ? formatDays(days) : ""}
          </td>
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
  const { data = [], error } = useQuery({
    queryKey: ["annualLeaves", year],
    queryFn: () => listAnnualLeaves(year),
  });

  return (
    <section>
      <Group justify="space-between" mt="xl" mb="xs">
        <Title order={4}>{year}년 연차 사용 현황</Title>
        <Text c="dimmed" fz="xs">연차 1일 · 반차 0.5일 · 반반차 0.25일 · 주는 월요일 시작 달력 기준</Text>
      </Group>
      {error && <Alert color="red" mb="sm">연차 정보를 불러오지 못했습니다.</Alert>}
      {/* 아주 좁은 화면에서만 가로 스크롤 허용 */}
      <div style={{ overflowX: "auto" }}>
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
                      style={{ ...cell, fontSize: 10, fontWeight: 400, color: "var(--mantine-color-dimmed)", background: monthBg(month, currentMonth) }}
                    >
                      {week}
                    </th>
                  </Tooltip>
                );
              }))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <AnnualLeaveRow
                key={`${year}-${item.memberId}-${item.confirmedDays}-${item.carriedDays}`}
                item={item}
                year={year}
                currentMonth={currentMonth}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
