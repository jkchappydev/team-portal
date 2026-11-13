import { useEffect, type ReactNode } from "react";
import { Alert, Button, Center, Group, Loader, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, logout } from "../api/auth";
import type { AuthMe } from "../api/auth";
import { ApiError } from "../api/client";
import { Navigate } from "react-router-dom";
import { ProfileSetup } from "./ProfileSetup";
import { ErrorPage } from "../layout/ErrorPage";

// Google 공식 "G" 로고 (로그인 버튼용)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// 로그인·승인 대기 등 인증 화면 공통 카드
function AuthCard({ children }: { children: ReactNode }) {
  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-default-hover)">
      <Paper withBorder radius="lg" p={32} w="100%" maw={400} shadow="xs">
        {children}
      </Paper>
    </Center>
  );
}

const iconProps = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function LoginPage() {
  const error = new URLSearchParams(window.location.search).get("error");
  return (
    <AuthCard>
      <Stack gap="lg">
        <Stack gap={6} align="center">
          {/* 로고 (흰 배경을 투명하게 바꾼 이미지라 다크 모드에서도 그대로 사용) */}
          <img src="/logo.png" alt="logo" height={44} style={{ display: "block" }} />
          <Title order={2} mt={8}>개발팀</Title>
          <Text size="sm" c="dimmed" ta="center">회사 Google 계정으로 로그인해 주세요</Text>
        </Stack>
        {error && (
          <Alert color="red" variant="light" radius="md">
            {error === "domain" ? "회사 계정(@example.com)으로 로그인해 주세요" : "로그인하지 못했습니다. 다시 시도해 주세요"}
          </Alert>
        )}
        <Button component="a" href="/oauth2/authorization/google" variant="default" size="md" radius="md" fullWidth leftSection={<GoogleIcon />}>
          Google로 로그인
        </Button>
        <Text size="xs" c="dimmed" ta="center">@example.com 계정만 사용할 수 있습니다.<br />처음 로그인하면 관리자 승인 후 이용할 수 있습니다.</Text>
      </Stack>
    </AuthCard>
  );
}

// 승인 대기·거절·비활성 상태 안내
function AccessStatus({ me }: { me: AuthMe }) {
  const pending = me.status === "PENDING";
  const message = pending ? "승인 진행 중입니다" : me.status === "REJECTED" ? "가입이 거절되었습니다. 관리자에게 문의하세요" : "접근 권한이 없습니다";
  return (
    <AuthCard>
      <Stack gap="lg" align="center">
        <ThemeIcon size={56} radius="xl" variant="light" color={pending ? "blue" : "red"}>
          <svg width="28" height="28" viewBox="0 0 24 24" {...iconProps}>
            <circle cx="12" cy="12" r="9" />
            {pending ? <path d="M12 7v5l3 2" /> : <path d="M5.7 5.7l12.6 12.6" />}
          </svg>
        </ThemeIcon>
        <Stack gap={6} align="center">
          <Title order={3} ta="center">{message}</Title>
          <Text size="sm" c="dimmed" ta="center">
            {pending ? "관리자가 가입을 승인하면 이 화면에서 바로 포털로 이동합니다." : "계정 상태는 관리자에게 문의해 주세요."}
          </Text>
        </Stack>
        {pending && (
          <Group gap={8}>
            <Loader size="xs" type="dots" />
            <Text size="xs" c="dimmed">승인 여부를 확인하는 중</Text>
          </Group>
        )}
        <Paper withBorder radius="md" px="md" py="xs" w="100%">
          <Text size="xs" c="dimmed">로그인한 계정</Text>
          <Text size="sm" fw={500}>{me.email}</Text>
        </Paper>
        <Button variant="subtle" color="gray" onClick={() => void logout()}>다른 계정으로 로그인</Button>
      </Stack>
    </AuthCard>
  );
}

// 로그인 정보를 확인하는 동안 보여주는 화면
function AuthLoading() {
  return <Center h="100vh"><Loader size="sm" aria-label="불러오는 중" /></Center>;
}

// 서버에 연결하지 못했을 때 자동으로 다시 확인하는 간격 (배포·재시작 중이면 잠시 뒤 저절로 돌아옴)
export const CONNECTION_RETRY_MS = 5000;

// 로그인 정보 확인 실패 시 공통 오류 페이지 (뒤에서는 계속 자동으로 다시 확인)
export function connectionErrorCode(error: unknown): string {
  return error instanceof ApiError ? String(error.status) : "Network Error";
}

export function LoginRoute() {
  const { data: me, isPending } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, retry: false });
  if (isPending) return <AuthLoading />;
  return me ? <Navigate to="/" replace /> : <LoginPage />;
}

// 승인 대기 중에는 관리자가 승인했는지 주기적으로 확인 (승인되면 새로고침 없이 바로 포털로 전환)
export const PENDING_RECHECK_MS = 5000;

export function pendingRecheckInterval(me: AuthMe | undefined): number | false {
  return me?.status === "PENDING" ? PENDING_RECHECK_MS : false;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: me, isPending, isFetching, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    // 승인 대기 중이거나, 처음부터 서버에 연결하지 못했으면 주기적으로 다시 확인
    refetchInterval: (query) => {
      const failed = query.state.error;
      if (!query.state.data && failed && !(failed instanceof ApiError && failed.code === "UNAUTHENTICATED")) return CONNECTION_RETRY_MS;
      return pendingRecheckInterval(query.state.data);
    },
    // 다른 탭에 있다가 돌아와도 바로 확인
    refetchOnWindowFocus: true,
  });
  // API가 승인 대기·비활성 등을 알리면 서버의 현재 상태를 다시 받아 그대로 따름
  // (삭제된 팀원은 재가입 요청으로 바뀌고, 다시 승인되면 바로 포털로 돌아옴)
  useEffect(() => {
    const changed = () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    };
    window.addEventListener("portal:auth-changed", changed);
    return () => window.removeEventListener("portal:auth-changed", changed);
  }, [queryClient]);
  if (isPending) return <AuthLoading />;
  if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return <LoginPage />;
  // 이미 들어와 있던 사용자는 다른 탭에서 돌아올 때 잠깐 연결이 끊겨도 작업 화면을 그대로 둠
  if (!me) return <ErrorPage code={connectionErrorCode(error)} actionLabel="다시 시도" loading={isFetching}
    onAction={() => void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })} />;
  const inactive = me.status === "APPROVED" && me.active === false;
  if (inactive || me.status !== "APPROVED") return <AccessStatus me={me} />;
  if (me.profileComplete === false) return <ProfileSetup me={me} />;
  return children;
}
