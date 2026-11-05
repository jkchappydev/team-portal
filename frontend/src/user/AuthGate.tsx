import { useEffect, useState, type ReactNode } from "react";
import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, logout } from "../api/auth";
import { ApiError } from "../api/client";
import { Navigate } from "react-router-dom";

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

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [inactive, setInactive] = useState(false);
  const { data: me, isPending, error } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, retry: false });
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "MEMBER_INACTIVE") setInactive(true);
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    };
    window.addEventListener("portal:auth-changed", changed);
    return () => window.removeEventListener("portal:auth-changed", changed);
  }, [queryClient]);
  if (isPending) return <Center h="100vh">불러오는 중...</Center>;
  if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return <LoginPage />;
  if (error || !me) return <Center h="100vh"><Stack align="center"><Text>로그인 정보를 불러오지 못했습니다.</Text>
    <Button onClick={() => void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })}>다시 시도</Button></Stack></Center>;
  if (inactive || me.status !== "APPROVED") return <Center h="100vh"><Stack align="center">
    <Text>{inactive ? "접근 권한이 없습니다" : me.status === "PENDING" ? "승인 진행 중입니다" : "가입이 거절되었습니다. 관리자에게 문의하세요"}</Text>
    <Text>{me.email}</Text><Button onClick={() => void logout()}>로그아웃</Button>
  </Stack></Center>;
  return children;
}
