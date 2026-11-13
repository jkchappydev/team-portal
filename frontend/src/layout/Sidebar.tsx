import { useState } from "react";
import { Alert, Box, Button, Group, Kbd, ScrollArea, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink as RouterLink, useNavigate } from "react-router-dom";
import { createSpace, listSpaces, moveSpace } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";
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
  // 이름 입력 창 없이 "제목 없음" 페이지를 바로 만들고, 열린 페이지의 제목 칸에서 이름을 입력
  const create = useMutation({
    mutationFn: () => createSpace(),
    onSuccess: (space) => {
      markNewItem(`space-${space.id}`);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      navigate(`/spaces/${space.id}`, space.homeDocumentId ? focusTitleState(space.homeDocumentId) : undefined);
    },
  });

  // 최상위 페이지 순서 변경: 화면 순서를 먼저 바꾸고 서버 반영 후 다시 조회 (실패 시 서버 순서로 복구)
  const reorder = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveSpace(id, index),
    onMutate: ({ id, index }) => {
      const current = queryClient.getQueryData<SpaceDto[]>(["spaces"]) ?? [];
      const moving = current.find((s) => s.id === id);
      if (!moving) return;
      const others = current.filter((s) => s.id !== id);
      others.splice(index, 0, moving);
      queryClient.setQueryData(["spaces"], others);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  });

  return (
    <Stack h="100%" gap="xs" p="sm">
      {/* 포털 이름을 누르면 첫 화면(근무 상황표)으로 이동 */}
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="lg" component={RouterLink} to="/" style={{ color: "inherit", textDecoration: "none" }}>
          개발팀
        </Text>
        {/* 다른 팀원이 수정한 페이지 알림 */}
        {user && <DocumentUpdatesBell />}
      </Group>
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
        <SidebarMenuLink to="/work-status" label="근무 상황표" icon={<span aria-hidden>📅</span>} />
        {/* 팀원 목록은 누구나 보고 본인 정보만 수정, 팀원 관리는 관리자만 */}
        <SidebarMenuLink to="/team" label="팀원 목록" icon={<span aria-hidden>📇</span>} />
        {user?.admin && <SidebarMenuLink to="/members" label="팀원 관리 (관리자 전용)" icon={<span aria-hidden>👥</span>} />}
      </Stack>
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed">페이지</Text>
        <Button size="compact-xs" variant="subtle" loading={create.isPending} onClick={() => create.mutate()}>+ 새 페이지</Button>
      </Group>
      {create.error && <Alert color="red" p="xs">페이지를 만들지 못했습니다.</Alert>}
      {/* 링크는 페이지 목록 바로 아래에 붙어 하위 페이지가 펼쳐지면 함께 밀려남 (둘을 한 스크롤로) */}
      <ScrollArea style={{ flex: 1 }} data-testid="sidebar-scroll">
        <Stack gap="xs">
          <SpaceList spaces={spaces} onMove={(id, index) => reorder.mutate({ id, index })} />
          {/* 팀이 함께 쓰는 외부 주소 (새 탭으로 열림) */}
          {user && <LinkList />}
        </Stack>
      </ScrollArea>
      {/* 다른 고정 메뉴와 같은 컬러 이모지 아이콘 */}
      <SidebarMenuLink to="/trash" label="휴지통" icon={<span aria-hidden>🗑️</span>} />
      <SearchDialog opened={searching} onClose={() => setSearching(false)} />
      <Group justify="space-between" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        {/* 이름(옆에 직급)을 누르면 내 설정 */}
        {user ? (
          <Button size="compact-sm" variant="subtle" color="gray" px={6} aria-label="내 설정"
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
    </Stack>
  );
}
