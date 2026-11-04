import { useState } from "react";
import { Button, Group, Modal, NavLink, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink as RouterLink, useNavigate } from "react-router-dom";
import { createSpace, listSpaces } from "../api/spaces";
import type { MemberDto } from "../api/members";

interface Props {
  user: MemberDto | null;
  onChangeUser: () => void;
}

export function Sidebar({ user, onChangeUser }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
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

  return (
    <Stack h="100%" gap="xs" p="sm">
      <Text fw={700} size="lg">팀 포털</Text>
      <NavLink component={RouterLink} to="/work-status" label="근무 상황표" />
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed">공간</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => setCreating(true)}>+ 새 공간</Button>
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        {spaces.map((space) => (
          <NavLink key={space.id} component={RouterLink} to={`/spaces/${space.id}`} label={space.name} />
        ))}
      </ScrollArea>
      <NavLink component={RouterLink} to="/search" label="검색" />
      <NavLink component={RouterLink} to="/trash" label="휴지통" />
      <NavLink component={RouterLink} to="/members" label="팀원 관리" />
      <Group justify="space-between" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
        <Text size="sm">{user?.name ?? "-"}</Text>
        <Button size="compact-xs" variant="subtle" onClick={onChangeUser}>변경</Button>
      </Group>
      <Modal opened={creating} onClose={() => setCreating(false)} title="새 공간" centered>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <Stack>
            <TextInput
              label="공간 이름"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              error={create.error ? "공간을 만들지 못했습니다." : undefined}
              data-autofocus
            />
            <Button type="submit" loading={create.isPending}>만들기</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
