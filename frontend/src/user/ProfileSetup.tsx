import { Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../api/auth";
import type { AuthMe } from "../api/auth";
import { MemberInfoForm } from "../members/MemberInfoForm";

// 승인 후 처음 들어온 팀원이 부서·직급·연락처를 직접 입력하는 화면
// 저장하면 서버 상태를 다시 받아 바로 포털로 넘어감
export function ProfileSetup({ me }: { me: AuthMe }) {
  const queryClient = useQueryClient();
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder radius="md" p="xl" w="100%" maw={420}>
        <Stack>
          <div>
            <Title order={3}>내 정보 입력</Title>
            <Text size="sm" c="dimmed" mt={4}>가입이 승인되었습니다. 팀원 목록에 보일 정보를 입력해 주세요. 이름·부서·직급은 꼭 입력하고, 전화번호·내선번호는 나중에 넣어도 됩니다.</Text>
          </div>
          <MemberInfoForm
            member={{ id: me.memberId!, name: me.memberName ?? "" }}
            submitLabel="시작하기"
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })}
          />
          <Text size="xs" c="dimmed">{me.email} · <Button variant="subtle" size="compact-xs" onClick={() => void logout()}>로그아웃</Button></Text>
        </Stack>
      </Paper>
    </Center>
  );
}
