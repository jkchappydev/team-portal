import { Anchor, Badge, Box, Grid, Group, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { listNewCs } from "../api/cs";
import { listRecentDocuments } from "../api/documents";
import { listHolidays } from "../api/holidays";
import { listSpaces } from "../api/spaces";
import { listWorkStatuses } from "../api/workStatuses";
import { PageIcon } from "../documents/PageIconView";
import { formatRelative, isProjectHome, updatePath } from "../notifications/updateFormat";
import { Panel } from "./Panel";
import { ProjectGallery } from "./ProjectGallery";
import { ServerMonitor } from "./ServerTable";
import { TYPE_COLORS, chipColors } from "../workstatus/types";
import { statusesByDay, monthsOf, thisWeekDays, weekDayLabel } from "./thisWeek";
import { CURRENT_HIGHLIGHT_BACKGROUND } from "../workstatus/highlight";
import { DayLabel } from "../workstatus/DayLabel";
import { useMediaQuery } from "@mantine/hooks";

const MOBILE_QUERY = "(max-width: 47.99em)";
// 최근 수정된 게시글·신규 CS는 최근 것부터 이 개수만
const LIST_LIMIT = 5;

// 아직 기능이 없는 칸 (영역만 잡아 둠)
function Upcoming({ message }: { message: string }) {
  return (
    <Box py="xl" style={{ borderRadius: 8, border: "1px dashed var(--mantine-color-default-border)" }}>
      <Text size="sm" c="dimmed" ta="center">{message}</Text>
    </Box>
  );
}

function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 이번 주 월~금 누가 연차·반차·출장·외근 등인지 (근무 상황표와 같은 칩 색)
function WeekStatuses() {
  const days = thisWeekDays();
  const months = monthsOf(days);
  const today = todayString();
  // 근무 상황표와 같은 조회 키를 써서 화면을 오가도 다시 받지 않음
  const statusQueries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: ["workStatuses", year, month],
      queryFn: () => listWorkStatuses(year, month),
    })),
  });
  const holidayQueries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: ["holidays", year, month],
      queryFn: () => listHolidays(year, month),
    })),
  });
  const byDay = statusesByDay(days, statusQueries.flatMap((q) => q.data ?? []));
  const holidays = new Map(holidayQueries.flatMap((q) => q.data ?? []).map((h) => [h.date, h.name]));
  const failed = statusQueries.some((q) => q.isError);
  const mobile = useMediaQuery(MOBILE_QUERY) ?? false;

  return (
    <Panel title="이번 주 근무 현황" action={<Anchor component={Link} to="/work-status" size="sm">근무 상황표</Anchor>}>
      {failed && <Text size="sm" c="red" mb="xs">근무 현황을 불러오지 못했습니다.</Text>}
      {mobile ? (
        // 좁은 화면: 근무 상황표 날짜 목록처럼 요일마다 한 줄 (요일 | 칩), 오늘은 배경 강조
        <Box style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8, overflow: "hidden" }}>
          {days.map((day, index) => {
            const items = byDay.get(day.date) ?? [];
            const holiday = holidays.get(day.date);
            const isToday = day.date === today;
            return (
              // 근무 상황표 좁은 화면 목록과 같은 줄 모양 (날짜 숫자 | 요일, 세로 가운데 정렬)
              <Group key={day.date} gap={12} wrap="nowrap" px={12} py={8} mih={44} data-today={isToday || undefined}
                aria-label={weekDayLabel(day)}
                style={{
                  borderTop: index > 0 ? "1px solid var(--mantine-color-default-border)" : undefined,
                  background: isToday ? CURRENT_HIGHLIGHT_BACKGROUND : undefined,
                }}>
                <DayLabel date={day.date} holiday={!!holiday} today={isToday} />
                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  {holiday && <Text size="xs" c="red" fw={600} lh={1.2}>{holiday}</Text>}
                  {items.map((item) => (
                    <Text key={item.id} size="xs" px={6} py={2} title={item.label}
                      style={{ borderRadius: 4, overflowWrap: "anywhere", ...chipColors(TYPE_COLORS[item.type]) }}>
                      {item.label}
                    </Text>
                  ))}
                </Stack>
              </Group>
            );
          })}
        </Box>
      ) : (
      <SimpleGrid cols={5} spacing="xs">
        {days.map((day) => {
          const items = byDay.get(day.date) ?? [];
          const holiday = holidays.get(day.date);
          const isToday = day.date === today;
          return (
            <Box key={day.date} p="xs" data-today={isToday || undefined} aria-label={weekDayLabel(day)}
              style={{
                borderRadius: 8,
                border: `1px solid ${isToday ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-default-border)"}`,
                minHeight: 96,
              }}>
              <Group gap={6} mb={6} wrap="nowrap">
                <Text size="sm" fw={600} c={holiday ? "red" : undefined}>{weekDayLabel(day)}</Text>
                {isToday && <Badge size="xs" variant="light">오늘</Badge>}
              </Group>
              {holiday && <Text size="xs" c="red" mb={4}>{holiday}</Text>}
              <Stack gap={4}>
                {items.map((item) => (
                  <Text key={item.id} size="xs" px={6} py={2} title={item.label}
                    style={{ borderRadius: 4, overflowWrap: "anywhere", ...chipColors(TYPE_COLORS[item.type]) }}>
                    {item.label}
                  </Text>
                ))}
                {items.length === 0 && !holiday && <Text size="xs" c="dimmed">없음</Text>}
              </Stack>
            </Box>
          );
        })}
      </SimpleGrid>
      )}
    </Panel>
  );
}

// 최근 수정한 페이지·파일과 마지막 수정자 (누르면 그 페이지로)
function RecentPosts() {
  const navigate = useNavigate();
  const { data: posts = [], isError, isLoading } = useQuery({ queryKey: ["documents", "recent"], queryFn: listRecentDocuments });
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });

  return (
    <Panel title="최근 수정된 게시글">
      {isError && <Text size="sm" c="red">최근 수정된 게시글을 불러오지 못했습니다.</Text>}
      {!isLoading && !isError && posts.length === 0 && <Text size="sm" c="dimmed">최근 수정된 게시글이 없습니다.</Text>}
      <Stack gap={0}>
        {posts.slice(0, LIST_LIMIT).map((post) => (
          <UnstyledButton key={post.id} className="update-item" px="xs" py={6} onClick={() => navigate(updatePath(post, spaces))}>
            <Text size="sm" truncate><PageIcon icon={post.icon} project={isProjectHome(post, spaces)} /> {post.title}</Text>
            <Text size="xs" c="dimmed" truncate>
              {post.spaceName} · {post.updatedByName || "알 수 없음"} · {formatRelative(post.updatedAt)}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
    </Panel>
  );
}

// CS 시스템 상태 색 (CS 게시판 목록과 같은 계열)
const CS_STATUS_COLORS: Record<string, string> = { REQS: "blue", PROG: "green", FEED: "orange", COMP: "indigo", HOLD: "gray" };

// CS 시스템에 최근 등록된 CS (요청 상태는 N 표시, 누르면 CS 시스템 상세 화면을 새 탭으로)
function NewCsList() {
  const { data, isError, isLoading } = useQuery({ queryKey: ["cs", "new"], queryFn: listNewCs });
  const items = data?.items ?? [];

  return (
    <Panel title="신규 CS">
      {isError && <Text size="sm" c="red">신규 CS를 불러오지 못했습니다.</Text>}
      {data && !data.configured && <Upcoming message="CS 시스템 연동 설정이 없습니다." />}
      {!isLoading && data?.configured && items.length === 0 && <Text size="sm" c="dimmed">등록된 CS가 없습니다.</Text>}
      <Stack gap={0}>
        {items.slice(0, LIST_LIMIT).map((cs) => (
          <UnstyledButton key={cs.id} component="a" href={cs.detailUrl} target="_blank" rel="noopener noreferrer"
            className="update-item" px="xs" py={6} style={{ color: "inherit", textDecoration: "none" }}>
            <Group gap={6} wrap="nowrap">
              {/* N 아이콘은 제목 바로 뒤 (제목이 길면 제목만 줄임), 한글 제목 가운데에 맞춰 1px 내림 */}
              <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" truncate style={{ minWidth: 0 }}>{cs.title}</Text>
                {cs.status === "REQS" && (
                  <img src="/ic_new.png" alt="새로 접수된 CS" width={14} height={14}
                    style={{ flexShrink: 0, display: "block", position: "relative", top: 1 }} />
                )}
              </Group>
              <Text size="xs" fw={500} c={`${CS_STATUS_COLORS[cs.status] ?? "gray"}.7`} style={{ flexShrink: 0 }}>
                {cs.statusName || cs.status}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {[cs.requesterName || "알 수 없음", cs.createdAt && formatRelative(cs.createdAt)]
                .filter(Boolean).join(" · ")}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
    </Panel>
  );
}

// 메인 화면: 이번 주 근무 현황 → 프로젝트 → 최근 수정된 게시글·신규 CS(각 최근 5개) → 서버 모니터링·이번 주 주간보고(추후 구현)
// 다른 메뉴 화면처럼 본문 폭을 다 쓰고(좌우 여백은 AppLayout 24px), 열 배치는 화면 폭이 아닌 본문 폭으로 정함
const GRID_BREAKPOINTS = { xs: "400px", sm: "600px", md: "760px", lg: "900px", xl: "1200px" };

export function MainPage() {
  return (
    <Stack gap="md">
      <WeekStatuses />
      <ProjectGallery />
      <Grid gap="md" type="container" breakpoints={GRID_BREAKPOINTS}>
        <Grid.Col span={{ base: 12, lg: 7 }}><RecentPosts /></Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}><NewCsList /></Grid.Col>
      </Grid>
      <Grid gap="md" type="container" breakpoints={GRID_BREAKPOINTS}>
        <Grid.Col span={{ base: 12, lg: 7 }}><ServerMonitor /></Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}><Panel title="이번 주 주간보고"><Upcoming message="준비 중입니다." /></Panel></Grid.Col>
      </Grid>
    </Stack>
  );
}
