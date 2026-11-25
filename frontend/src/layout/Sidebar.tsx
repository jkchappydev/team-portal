import { Fragment, useState } from "react";
import { Button, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createSpace, listSpaces, moveSpace } from "../api/spaces";
import type { SpaceDto, SpaceKind, SpaceSection } from "../api/spaces";
import { moveToSection, sectionOf, SPACE_SECTIONS } from "../documents/spaceKind";
import { CreateSpaceModal } from "./CreateSpaceModal";
import type { MemberDto } from "../api/members";
import { focusTitleState } from "../documents/titleFocus";
import { SidebarMenuLink } from "./SidebarMenuLink";
import { ActivityIcon, ArchiveIcon, CalendarIcon, ContactBookIcon, HomeIcon, StarIcon, TrashIcon, UserCogIcon, UsersIcon } from "./SidebarIcons";
import { SpaceList } from "./SpaceList";
import { LinkList } from "./LinkList";
import { markNewItem } from "./reorderAnimation";
import { useLastValue } from "./useLastValue";

interface Props {
  user: MemberDto | null;
}

export function Sidebar({ user }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces, enabled: user !== null });
  // 프로젝트·페이지 중 고르는 창을 연 칸 (내부/외부 프로젝트, 이름은 만든 뒤 열린 화면의 제목 칸에서 입력)
  const [creatingIn, setCreatingIn] = useState<SpaceSection | null>(null);
  // 창이 닫히는 동안에도 제목의 칸 이름을 유지
  const shownSection = useLastValue(creatingIn);
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
      {/* 즐겨찾기부터 휴지통까지 메뉴 전체를 한 스크롤로 (포털 이름·검색·내 정보는 상단 바)
          스크롤바 자리를 따로 비워 오른쪽 버튼·글자와 겹치지 않게 함 */}
      {/* 마우스가 사이드바를 벗어나면 스크롤바를 바로 숨김 (기본 1초 지연 제거)
          스크롤바는 사이드바 오른쪽 경계선에 붙이고(바깥 여백만큼 넓힘), 메뉴는 원래 자리에 둠 */}
      <ScrollArea style={{ flex: 1 }} mr="calc(var(--mantine-spacing-sm) * -1)" offsetScrollbars="y" scrollbarSize={8}
        scrollHideDelay={0} data-testid="sidebar-scroll">
        <Stack gap="xs" pr="sm">
          {/* 개인 즐겨찾기는 머리글 없이 맨 위 (검색은 상단 바로 옮김) */}
          <Stack gap={0}>
            <SidebarMenuLink to="/favorites" label="즐겨찾기" icon={<StarIcon />} />
          </Stack>
          {/* 팀이 함께 쓰는 메뉴 머리글 (페이지·링크 머리글과 같은 모양, 추가 버튼 없음) */}
          <Group justify="space-between" mt="sm" mih={22}>
            <Text size="xs" c="dimmed">팀 스페이스</Text>
          </Group>
          <Stack gap={0}>
            <SidebarMenuLink to="/main" label="메인" icon={<HomeIcon />} />
            <SidebarMenuLink to="/work-status" label="근무 상황표" icon={<CalendarIcon />} />
            {/* 팀원 목록은 누구나 보고 본인 정보만 수정, 팀원 관리는 관리자만 */}
            <SidebarMenuLink to="/team" label="팀원 목록" icon={<UsersIcon />} />
            {/* 회사 밖 업체 담당자 연락처 (팀 공용) */}
            <SidebarMenuLink to="/contacts" label="외부 연락처" icon={<ContactBookIcon />} />
            {/* 팀이 함께 쓰는 양식·자료 파일 (올리기·미리보기·다운로드) */}
            <SidebarMenuLink to="/forms" label="공유 보관함" icon={<ArchiveIcon />} />
            {/* 포털 서버 자원과 서버에서 도는 애플리케이션·DB 상태 */}
            <SidebarMenuLink to="/monitoring" label="모니터링" icon={<ActivityIcon />} />
            {user?.admin && <SidebarMenuLink to="/members" label="팀원 관리 (관리자 전용)" icon={<UserCogIcon />} />}
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
          <SidebarMenuLink to="/trash" label="휴지통" icon={<TrashIcon />} />
        </Stack>
      </ScrollArea>
      <CreateSpaceModal opened={creatingIn !== null} pending={create.isPending} error={create.error ? "만들지 못했습니다." : null}
        title={`${SPACE_SECTIONS.find((section) => section.value === shownSection)?.label ?? ""}에 새로 만들기`}
        onClose={() => setCreatingIn(null)} onCreate={(kind) => creatingIn && create.mutate({ kind, section: creatingIn })} />
    </Stack>
  );
}
