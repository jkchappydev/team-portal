import { useEffect, type ReactNode } from "react";
import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, logout } from "../api/auth";
import type { AuthMe } from "../api/auth";
import { ApiError } from "../api/client";
import { Navigate } from "react-router-dom";
import { ProfileSetup } from "./ProfileSetup";

export function LoginPage() {
  const error = new URLSearchParams(window.location.search).get("error");
  return <Center h="100vh"><Stack align="center"><Title order={2}>팀 포털</Title>
    {error && <Text c="red">{error === "domain" ? "회사 계정(@example.com)으로 로그인해 주세요" : "로그인하지 못했습니다. 다시 시도해 주세요"}</Text>}
    <Button component="a" href="/oauth2/authorization/google">Google로 로그인</Button>
  </Stack></Center>;
}

export function LoginRoute() {
  const { data: me, isPending } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, retry: false });
  if (isPending) return <Center h="100vh">불러오는 중...</Center>;
  return me ? <Navigate to="/" replace /> : <LoginPage />;
}

// 승인 대기 중에는 관리자가 승인했는지 주기적으로 확인 (승인되면 새로고침 없이 바로 포털로 전환)
export const PENDING_RECHECK_MS = 5000;

export function pendingRecheckInterval(me: AuthMe | undefined): number | false {
  return me?.status === "PENDING" ? PENDING_RECHECK_MS : false;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: me, isPending, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    refetchInterval: (query) => pendingRecheckInterval(query.state.data),
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
  if (isPending) return <Center h="100vh">불러오는 중...</Center>;
  if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return <LoginPage />;
  if (error || !me) return <Center h="100vh"><Stack align="center"><Text>로그인 정보를 불러오지 못했습니다.</Text>
    <Button onClick={() => void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })}>다시 시도</Button></Stack></Center>;
  const inactive = me.status === "APPROVED" && me.active === false;
  if (inactive || me.status !== "APPROVED") return <Center h="100vh"><Stack align="center">
    <Text>{me.status === "PENDING" ? "승인 진행 중입니다" : me.status === "REJECTED" ? "가입이 거절되었습니다. 관리자에게 문의하세요" : "접근 권한이 없습니다"}</Text>
    <Text>{me.email}</Text><Button onClick={() => void logout()}>로그아웃</Button>
  </Stack></Center>;
  if (me.profileComplete === false) return <ProfileSetup me={me} />;
  return children;
}
