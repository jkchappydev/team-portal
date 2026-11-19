import { Box, Text } from "@mantine/core";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_NUMBER_COLOR = "light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-1))";

// 날짜 목록의 날짜 칸 (근무 상황표 좁은 화면 목록·메인 이번 주 근무 현황 공용)
// 날짜 숫자·요일 칸을 각각 고정 폭으로 두어 한 자리·두 자리 날짜여도 요일이 같은 세로줄에 옴
// 공휴일·일요일은 빨강, 토요일은 파랑, 오늘은 굵게
export function DayLabel({ date, holiday, today }: { date: string; holiday: boolean; today: boolean }) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const color = holiday || weekday === 0 ? "var(--mantine-color-red-text)" : weekday === 6 ? "var(--mantine-color-blue-text)" : DAY_NUMBER_COLOR;
  return (
    <Box style={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: 4, color, fontVariantNumeric: "tabular-nums" }}>
      <Text span fz="sm" fw={today ? 700 : 500} w={20} style={{ whiteSpace: "nowrap" }}>{Number(date.slice(8))}</Text>
      <Text span fz="xs" w={14}>{DAY_NAMES[weekday]}</Text>
    </Box>
  );
}
