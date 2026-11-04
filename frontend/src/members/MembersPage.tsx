import { useState } from "react";
import { Alert, Button, Group, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMember, listMembers, updateMember } from "../api/members";
import type { MemberDto } from "../api/members";

function MemberRow({ member }: { member: MemberDto }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(member.name);
  const update = useMutation({
    mutationFn: (patch: { name?: string; active?: boolean }) => updateMember(member.id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput value={name} maxLength={50} onChange={(e) => setName(e.currentTarget.value)} />
      </Table.Td>
      <Table.Td>
        <Switch
          checked={member.active}
          label={member.active ? "활성" : "비활성"}
          onChange={(e) => update.mutate({ active: e.currentTarget.checked })}
        />
      </Table.Td>
      <Table.Td>
        <Button
          size="xs"
          disabled={!name.trim() || name.trim() === member.name}
          loading={update.isPending}
          onClick={() => update.mutate({ name: name.trim() })}
        >
          이름 저장
        </Button>
        {update.error && <Text c="red" size="xs">변경하지 못했습니다.</Text>}
      </Table.Td>
    </Table.Tr>
  );
}

export function MembersPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const { data: members = [], error } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true) });
  const create = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setNewName("");
    },
  });

  return (
    <Stack maw={720}>
      <Title order={3}>팀원 관리</Title>
      {error && <Alert color="red">팀원 목록을 불러오지 못했습니다.</Alert>}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>이름</Table.Th>
            <Table.Th>상태</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {members.map((member) => (
            <MemberRow key={`${member.id}-${member.name}`} member={member} />
          ))}
        </Table.Tbody>
      </Table>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) create.mutate(newName.trim());
        }}
      >
        <Group align="flex-end">
          <TextInput
            label="새 팀원"
            placeholder="이름"
            maxLength={50}
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            error={create.error ? "추가하지 못했습니다." : undefined}
          />
          <Button type="submit" loading={create.isPending}>추가</Button>
        </Group>
      </form>
    </Stack>
  );
}
