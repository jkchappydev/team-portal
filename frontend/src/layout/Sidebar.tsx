import { useState } from "react";
import { Button, Group, Kbd, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink as RouterLink, useNavigate } from "react-router-dom";
import { createSpace, listSpaces, moveSpace } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";
import type { MemberDto } from "../api/members";
import { ColorSchemeToggle } from "./ColorSchemeToggle";
import { SearchDialog } from "../documents/SearchDialog";
import { DocumentUpdatesBell } from "../notifications/DocumentUpdatesBell";
import { SidebarMenuLink } from "./SidebarMenuLink";
import { SpaceList } from "./SpaceList";
import { logout } from "../api/auth";

interface Props {
  user: MemberDto | null;
}

// 노션처럼 얇은 선으로 그린 휴지통 아이콘 (글자색을 따라감)
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75h4V4" />
      <path d="M3.75 4l.7 9.25h7.1l.7-9.25" />
      <path d="M6.5 6.5v4.5M9.5 6.5v4.5" />
    </svg>
  );
}

export function Sidebar({ user }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  // 노션처럼 어디서든 Ctrl/Cmd+K로 검색 창 열기
  useHotkeys([["mod+K", () => setSearching(true)]], []);
  const [name, setName] = useState("");
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces, enabled: user !== null });
  const create = useMutation({
    mutationFn: (spaceName: string) => createSpace(spaceName),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      setCreating(false);
      setName("");
      navigate(`/spaces/${space.id}`);
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
          팀 포털
        </Text>
        {/* 다른 팀원이 수정한 페이지 알림 */}
        {user && <DocumentUpdatesBell />}
      </Group>
      {/* 고정 메뉴는 페이지 트리 줄과 같은 높이로 붙여서 표시 */}
      <Stack gap={0}>
        <SidebarMenuLink
          label="검색"
          icon={<span aria-hidden>🔍</span>}
          rightSection={<Kbd size="xs">Ctrl + K</Kbd>}
          onClick={() => setSearching(true)}
        />
        <SidebarMenuLink to="/work-status" label="근무 상황표" icon={<span aria-hidden>📅</span>} />
        {/* 가입 승인과 팀원 정보 변경은 관리자만 */}
        {user?.admin && <SidebarMenuLink to="/members" label="팀원 관리" icon={<span aria-hidden>👥</span>} />}
      </Stack>
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed">페이지</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => setCreating(true)}>+ 새 페이지</Button>
      </Group>
      <SpaceList spaces={spaces} onMove={(id, index) => reorder.mutate({ id, index })} />
      <SidebarMenuLink to="/trash" label="휴지통" icon={<TrashIcon />} />
      <SearchDialog opened={searching} onClose={() => setSearching(false)} />
      <ColorSchemeToggle />
      <Group justify="space-between" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        <Text size="sm">{user?.name ?? "-"}</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => void logout()}>로그아웃</Button>
      </Group>
      <Modal opened={creating} onClose={() => setCreating(false)} title="새 페이지" centered>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <Stack>
            <TextInput
              label="페이지 이름"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              error={create.error ? "페이지를 만들지 못했습니다." : undefined}
              data-autofocus
            />
            <Button type="submit" loading={create.isPending}>만들기</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
