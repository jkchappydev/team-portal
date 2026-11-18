import { Fragment, useState } from "react";
import { Box, Button, Group, Kbd, ScrollArea, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink as RouterLink, useNavigate } from "react-router-dom";
import { createSpace, listSpaces, moveSpace } from "../api/spaces";
import type { SpaceDto, SpaceKind, SpaceSection } from "../api/spaces";
import { moveToSection, sectionOf, SPACE_SECTIONS } from "../documents/spaceKind";
import { CreateSpaceModal } from "./CreateSpaceModal";
import type { MemberDto } from "../api/members";
import { SearchDialog } from "../documents/SearchDialog";
import { focusTitleState } from "../documents/titleFocus";
import { DocumentUpdatesBell } from "../notifications/DocumentUpdatesBell";
import { SidebarMenuLink } from "./SidebarMenuLink";
import { SpaceList } from "./SpaceList";
import { LinkList } from "./LinkList";
import { markNewItem } from "./reorderAnimation";
import { logout } from "../api/auth";
import { ProfileSettingsModal } from "../user/ProfileSettingsModal";
import { RankBadge } from "../members/RankBadge";

interface Props {
  user: MemberDto | null;
}

export function Sidebar({ user }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 노션처럼 어디서든 Ctrl/Cmd+K로 검색 창 열기
  useHotkeys([["mod+K", () => setSearching(true)]], []);
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces, enabled: user !== null });
  // 프로젝트·페이지 중 고르는 창을 연 칸 (내부/외부 프로젝트, 이름은 만든 뒤 열린 화면의 제목 칸에서 입력)
  const [creatingIn, setCreatingIn] = useState<SpaceSection | null>(null);
  // 이름 입력 창 없이 "제목 없음"으로 바로 만들고, 열린 화면의 제목 칸에서 이름을 입력
  const create = useMutation({
    mutationFn: ({ kind, section }: { kind: SpaceKind; section: SpaceSection }) => createSpace(undefined, undefined, kind, section),
    onSuccess: (space) => {
      setCreatingIn(null);
      markNewItem(`space-${space.id}`);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      navigate(`/spaces/${space.id}`, space.homeDocumentId ? focusTitleState(space.homeDocumentId) : undefined);
    },
  });

  // 최상위 항목 순서·칸 변경: 화면 순서를 먼저 바꾸고 서버 반영 후 다시 조회 (실패 시 서버 순서로 복구)
  const reorder = useMutation({
    mutationFn: ({ id, index, section }: { id: number; index: number; section: SpaceSection }) => moveSpace(id, index, section),
    onMutate: ({ id, index, section }) => {
      const current = queryClient.getQueryData<SpaceDto[]>(["spaces"]) ?? [];
      queryClient.setQueryData(["spaces"], moveToSection(current, id, index, section));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  });

  return (
    <Stack h="100%" gap="xs" p="sm">
      {/* 포털 이름을 누르면 첫 화면(메인)으로 이동 */}
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="lg" component={RouterLink} to="/" style={{ color: "inherit", textDecoration: "none" }}>
          개발팀
        </Text>
        {/* 다른 팀원이 수정한 페이지 알림 */}
        {user && <DocumentUpdatesBell />}
      </Group>
      {/* 노션처럼 검색부터 휴지통까지 메뉴 전체를 한 스크롤로 (포털 이름과 아래 내 정보 줄은 고정)
          스크롤바 자리를 따로 비워 오른쪽 버튼·글자와 겹치지 않게 함 */}
      {/* 마우스가 사이드바를 벗어나면 스크롤바를 바로 숨김 (기본 1초 지연 제거)
          스크롤바는 사이드바 오른쪽 경계선에 붙이고(바깥 여백만큼 넓힘), 메뉴는 원래 자리에 둠 */}
      <ScrollArea style={{ flex: 1 }} mr="calc(var(--mantine-spacing-sm) * -1)" offsetScrollbars="y" scrollbarSize={8}
        scrollHideDelay={0} data-testid="sidebar-scroll">
        <Stack gap="xs" pr="sm">
          {/* 검색 도구와 개인 즐겨찾기는 머리글 없이 맨 위 (고정 메뉴는 페이지 트리 줄과 같은 높이로 붙여서 표시) */}
          <Stack gap={0}>
            <SidebarMenuLink
              label="검색"
              icon={<span aria-hidden>🔍</span>}
              rightSection={<Kbd size="xs">Ctrl + K</Kbd>}
              onClick={() => setSearching(true)}
            />
            <SidebarMenuLink to="/favorites" label="즐겨찾기" icon={<span aria-hidden>⭐</span>} />
          </Stack>
          {/* 팀이 함께 쓰는 메뉴 머리글 (페이지·링크 머리글과 같은 모양, 추가 버튼 없음) */}
          <Group justify="space-between" mt="sm" mih={22}>
            <Text size="xs" c="dimmed">팀 스페이스</Text>
          </Group>
          <Stack gap={0}>
            <SidebarMenuLink to="/main" label="메인" icon={<span aria-hidden>🏠</span>} />
            <SidebarMenuLink to="/work-status" label="근무 상황표" icon={<span aria-hidden>📅</span>} />
            {/* 팀원 목록은 누구나 보고 본인 정보만 수정, 팀원 관리는 관리자만 */}
            <SidebarMenuLink to="/team" label="팀원 목록" icon={<span aria-hidden>📇</span>} />
            {/* 회사 밖 업체 담당자 연락처 (팀 공용) */}
            <SidebarMenuLink to="/contacts" label="외부 연락처" icon={<span aria-hidden>📒</span>} />
            {user?.admin && <SidebarMenuLink to="/members" label="팀원 관리 (관리자 전용)" icon={<span aria-hidden>👥</span>} />}
          </Stack>
          {/* 내부 프로젝트·외부 프로젝트 칸 (각 칸에서 만들고, 칸 사이로 끌어 옮기면 구분이 바뀜) */}
          {SPACE_SECTIONS.map(({ value, label }) => (
            <Fragment key={value}>
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">{label}</Text>
                <Button size="compact-xs" variant="subtle" aria-label={`${label} 새로 만들기`}
                  loading={create.isPending && create.variables?.section === value}
                  onClick={() => { create.reset(); setCreatingIn(value); }}>+ 새로 만들기</Button>
              </Group>
              <SpaceList spaces={spaces.filter((space) => sectionOf(space) === value)}
                onMove={(id, index) => reorder.mutate({ id, index, section: value })} />
            </Fragment>
          ))}
          {/* 링크는 프로젝트 목록 바로 아래에 붙음 */}
          {/* 팀이 함께 쓰는 외부 주소 (새 탭으로 열림) */}
          {user && <LinkList />}
          {/* 다른 고정 메뉴와 같은 컬러 이모지 아이콘 */}
          <SidebarMenuLink to="/trash" label="휴지통" icon={<span aria-hidden>🗑️</span>} />
        </Stack>
      </ScrollArea>
      <SearchDialog opened={searching} onClose={() => setSearching(false)} />
      <Group justify="space-between" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        {/* 이름(옆에 직책)을 누르면 설정 창 */}
        {user ? (
          <Button size="compact-sm" variant="subtle" color="gray" px={6} aria-label="설정"
            onClick={() => setSettingsOpen(true)} styles={{ root: { cursor: "pointer" }, label: { fontWeight: 400, cursor: "pointer" } }}>
            {user.name}
            {user.jobRank && <Box component="span" ml={6}><RankBadge rank={user.jobRank} style={{ cursor: "pointer" }} /></Box>}
          </Button>
        ) : (
          <Text size="sm">-</Text>
        )}
        <Button size="compact-xs" variant="subtle" onClick={() => void logout()}>로그아웃</Button>
      </Group>
      {user && <ProfileSettingsModal user={user} opened={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      <CreateSpaceModal opened={creatingIn !== null} pending={create.isPending} error={create.error ? "만들지 못했습니다." : null}
        title={`${SPACE_SECTIONS.find((section) => section.value === creatingIn)?.label ?? ""}에 새로 만들기`}
        onClose={() => setCreatingIn(null)} onCreate={(kind) => creatingIn && create.mutate({ kind, section: creatingIn })} />
    </Stack>
  );
}
