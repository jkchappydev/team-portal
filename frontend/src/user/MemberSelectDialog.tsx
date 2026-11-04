import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMember, listMembers } from "../api/members";

interface Props {
  opened: boolean;
  onSelect: (id: number) => void;
}

// 닫을 수 없는 사용자 선택 창 (활성 팀원 목록 + 새 팀원 추가)
export function MemberSelectDialog({ opened, onSelect }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { data: members = [], error } = useQuery({ queryKey: ["members", false], queryFn: () => listMembers(false) });
  const create = useMutation({
    mutationFn: createMember,
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setName("");
      onSelect(member.id);
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title="사용자를 선택하세요"
      centered
    >
      <Stack>
        {error && <Alert color="red">팀원 목록을 불러오지 못했습니다.</Alert>}
        {members.length === 0 && !error && <Text c="dimmed">등록된 팀원이 없습니다. 아래에서 추가하세요.</Text>}
        {members.map((member) => (
          <Button key={member.id} variant="default" onClick={() => onSelect(member.id)}>
            {member.name}
          </Button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <Group align="flex-end">
            <TextInput
              label="새 팀원 추가"
              placeholder="이름"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={{ flex: 1 }}
              error={create.error ? "추가하지 못했습니다." : undefined}
            />
            <Button type="submit" loading={create.isPending}>
              추가
            </Button>
          </Group>
        </form>
      </Stack>
    </Modal>
  );
}
