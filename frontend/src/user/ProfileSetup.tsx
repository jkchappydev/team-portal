import { Alert, Button, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import type { AuthMe } from "../api/auth";
import { MemberInfoForm } from "../members/MemberInfoForm";
import { useCurrentUser } from "./currentUser";

// 승인 후 처음 들어온 팀원이 부서·직급·연락처를 직접 입력하는 화면
// 저장하면 서버 상태를 다시 받아 바로 포털로 넘어감
// onPreviewDone이 있으면 미리보기: 이미 가입한 개발자가 화면을 확인하는 용도 (저장하지 않음)
export function ProfileSetup({ me, onPreviewDone }: { me: AuthMe; onPreviewDone?: () => void }) {
  const queryClient = useQueryClient();
  const preview = onPreviewDone !== undefined;
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder radius="md" p="xl" w="100%" maw={420}>
        <Stack>
          {preview && <Alert color="yellow" variant="light" p="xs">미리보기 화면입니다. 입력해도 저장되지 않습니다.</Alert>}
          <div>
            <Title order={3}>내 정보 입력</Title>
            <Text size="sm" c="dimmed" mt={4}>가입이 승인되었습니다. 팀원 목록에 보일 정보를 입력해 주세요. 이름·부서·직급은 꼭 입력하고, 전화번호·내선번호는 나중에 넣어도 됩니다.</Text>
          </div>
          <MemberInfoForm
            member={{ id: me.memberId!, name: me.memberName ?? "" }}
            submitLabel="시작하기"
            preview={preview}
            onSaved={() => onPreviewDone ? onPreviewDone() : void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })}
          />
          <Text size="xs" c="dimmed">{me.email} · <Button variant="subtle" size="compact-xs" onClick={() => void logout()}>로그아웃</Button></Text>
        </Stack>
      </Paper>
    </Center>
  );
}

// /preview/profile-setup: 개발자만 열 수 있는 최초 가입 정보 입력 화면 미리보기
export function ProfileSetupPreview() {
  const { user, me } = useCurrentUser();
  const navigate = useNavigate();
  if (!me) return null;
  if (!user?.developer) return <Navigate to="/work-status" replace />;
  return <ProfileSetup me={me} onPreviewDone={() => navigate("/team")} />;
}
